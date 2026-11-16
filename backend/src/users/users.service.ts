import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, UserStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AccessService } from '../common/access/access.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../common/utils/password.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateUserDto, ResetPasswordDto, ScopeAssignmentDto, UpdateUserDto, UserQueryDto } from './dto/users.dto';

const userInclude = {
  userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
  scopeAssignments: true,
  employee: { select: { id:true, code:true, firstName:true, lastName:true, orgUnit:{select:{id:true,name:true}}, position:{select:{id:true,title:true}} } },
} satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly access: AccessService) {}

  private protectedAccount(user: UserRow) {
    return user.isSuperAdmin || user.userRoles.some(assignment => assignment.role.code === 'SUPER_ADMIN' || assignment.role.rolePermissions.some(row => ['*', PERMISSIONS.USERS_MANAGE_SUPERADMIN].includes(row.permission.code)));
  }

  private async target(id: string, actor: AuthenticatedUser, db: Prisma.TransactionClient = this.prisma): Promise<UserRow> {
    const row = await db.user.findUnique({ where:{id}, include:userInclude });
    if (!row || row.deletedAt) throw new NotFoundException('کاربر موردنظر یافت نشد.');
    if (!actor.isSuperAdmin && this.protectedAccount(row)) throw new ForbiddenException('این حساب تحت حفاظت مدیر ارشد است.');
    if (!actor.isSuperAdmin && !actor.scope.unrestricted && actor.id !== id) {
      if (!row.employeeId) throw new ForbiddenException('به این حساب دسترسی ندارید.');
      await this.access.assertEmployeeAccess(actor, row.employeeId);
    }
    return row;
  }

  private async reauthenticateProtected(row: UserRow, actor: AuthenticatedUser, password?: string, db: Prisma.TransactionClient = this.prisma) {
    if (!this.protectedAccount(row)) return;
    if (!actor.isSuperAdmin || !this.access.hasPermission(actor, PERMISSIONS.USERS_MANAGE_SUPERADMIN)) throw new ForbiddenException('مجوز مدیریت حساب محافظت‌شده را ندارید.');
    const current = await db.user.findUnique({ where:{id:actor.id} });
    if (!password || !current || current.deletedAt || current.status !== 'ACTIVE' || !await verifyPassword(current.passwordHash,password)) throw new ForbiddenException('برای تغییر حساب محافظت‌شده، گذرواژهٔ فعلی خودتان را وارد کنید.');
  }

  private async revoke(db: Prisma.TransactionClient, userId: string) {
    const now = new Date();
    await db.refreshToken.updateMany({ where:{userId,OR:[{revokedAt:null},{revokedAt:{gt:now}}]}, data:{revokedAt:now} });
    await db.userSession.updateMany({ where:{userId,OR:[{revokedAt:null},{revokedAt:{gt:now}}]}, data:{revokedAt:now} });
  }

  private async record(db: Prisma.TransactionClient, actorId: string, entityId: string, action: AuditAction, after: object) {
    await db.auditLog.create({ data:{userId:actorId,entity:'User',entityId,action,after:JSON.stringify(after)} });
  }

  async list(query: UserQueryDto, pagination: PaginationDto, actor: AuthenticatedUser) {
    const where: Prisma.UserWhereInput = {
      deletedAt:null,
      AND: actor.isSuperAdmin || actor.scope.unrestricted ? [] : [{OR:[{id:actor.id},{isSuperAdmin:false,employee:{is:this.access.employeeWhereFor(actor)}}]}],
      ...(query.status ? {status:query.status} : {}),
      ...(query.roleId ? {userRoles:{some:{roleId:query.roleId}}} : {}),
      ...(query.search ? {OR:[{username:{contains:query.search,mode:'insensitive'}},{fullName:{contains:query.search,mode:'insensitive'}}]} : {}),
    };
    const [total,rows] = await Promise.all([
      this.prisma.user.count({where}),
      this.prisma.user.findMany({where,skip:pagination.skip,take:pagination.limit,orderBy:{createdAt:'desc'},include:userInclude}),
    ]);
    return {success:true,data:rows.map(row=>this.toPublic(row)),meta:{total,page:pagination.page,limit:pagination.limit,totalPages:Math.max(1,Math.ceil(total/pagination.limit)),hasNext:pagination.page*pagination.limit<total,hasPrev:pagination.page>1},timestamp:new Date().toISOString()};
  }

  async get(id: string, actor: AuthenticatedUser) {
    const row = await this.target(id,actor);
    const sessions = actor.id === id || this.access.hasPermission(actor,PERMISSIONS.USERS_MANAGE_SESSIONS)
      ? await this.prisma.userSession.findMany({where:{userId:id,revokedAt:null},select:{id:true,device:true,browser:true,lastSeenAt:true,createdAt:true},orderBy:{lastSeenAt:'desc'}}) : [];
    return {...this.toPublic(row),sessions};
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    if ((dto.roleIds?.length || dto.scope?.length) && !this.access.hasPermission(actor,PERMISSIONS.USERS_MANAGE_ROLES)) throw new ForbiddenException('مجوز واگذاری نقش و حوزه را ندارید.');
    const strength = validatePasswordStrength(dto.password,10);
    if (!strength.ok) throw new BadRequestException(strength.message);
    const username = dto.username.trim().toLowerCase();
    if (!username || !dto.fullName.trim()) throw new BadRequestException('نام کاربری و نام کامل الزامی‌اند.');
    if (await this.prisma.user.findFirst({where:{username:{equals:username,mode:'insensitive'}}})) throw new BadRequestException('این نام کاربری قبلاً ثبت شده است.');
    await this.access.assertGrantableRoles(actor,dto.roleIds ?? []);
    await this.access.assertGrantableScopes(actor,dto.scope ?? []);
    if (dto.employeeId) await this.access.assertEmployeeAccess(actor,dto.employeeId);
    const needsProfile = !dto.employeeId && !!(dto.employeeCode || dto.positionId || dto.orgUnitId || dto.hireDate);
    if (!dto.employeeId && !needsProfile && !actor.isSuperAdmin) throw new BadRequestException('برای ایجاد حساب، پروندهٔ کارمند را انتخاب کنید.');
    const companyId = needsProfile
      ? await this.access.resolveCompanyIdForRefs(actor, {
          branchId: dto.branchId ?? null,
          orgUnitId: dto.orgUnitId ?? null,
          positionId: dto.positionId ?? null,
        })
      : null;
    if (companyId) {
      await this.access.assertCompanyAccess(actor,companyId);
      await this.access.assertEmployeeRelations(companyId,dto);
      if (!actor.isSuperAdmin && !actor.scope.unrestricted && !actor.scope.companyIds.includes(companyId) && !actor.scope.branchIds.includes(dto.branchId ?? '') && !actor.scope.orgUnitIds.includes(dto.orgUnitId ?? '')) throw new ForbiddenException('ایجاد پرونده در این حوزه مجاز نیست.');
    }
    const passwordHash = await hashPassword(dto.password);
    const row = await this.prisma.$transaction(async db => {
      let employeeId = dto.employeeId ?? null;
      if (companyId) {
        const [firstName,...rest] = dto.fullName.trim().split(/\s+/);
        const employee = await db.employee.create({data:{
          companyId,code:dto.employeeCode?.trim() || `U${randomUUID().slice(0,8)}`,firstName,lastName:rest.join(' ') || '—',
          branchId:dto.branchId ?? null,orgUnitId:dto.orgUnitId ?? null,positionId:dto.positionId ?? null,
          nationalId:dto.nationalId ?? null,gender:dto.gender ?? null,maritalStatus:dto.maritalStatus ?? null,
          birthDate:dto.birthDate ? new Date(dto.birthDate) : null,mobile:dto.mobile ?? null,email:dto.email ?? null,
          employmentType:dto.employmentType ?? 'PERMANENT',hireDate:dto.hireDate ? new Date(dto.hireDate) : new Date(),monthlyBaseSalary:BigInt(dto.monthlyBaseSalary ?? 0),
        }});
        employeeId=employee.id;
      }
      const user = await db.user.create({data:{
        username,fullName:dto.fullName.trim(),passwordHash,email:dto.email ?? null,mobile:dto.mobile ?? null,employeeId,
        mustChangePassword:dto.mustChangePassword ?? true,passwordChangedAt:new Date(),
        userRoles:{create:[...new Set(dto.roleIds ?? [])].map(roleId=>({roleId,grantedById:actor.id}))},
        scopeAssignments:{create:(dto.scope ?? []).map(scope=>this.scopeData(scope))},
      },include:userInclude});
      await this.record(db,actor.id,user.id,AuditAction.CREATE,{employeeId,roleIds:dto.roleIds ?? []});
      return user;
    });
    return this.toPublic(row);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    if ((dto.roleIds !== undefined || dto.scope !== undefined) && !this.access.hasPermission(actor,PERMISSIONS.USERS_MANAGE_ROLES)) throw new ForbiddenException('مجوز واگذاری نقش و حوزه را ندارید.');
    const before = await this.target(id,actor);
    await this.reauthenticateProtected(before,actor,dto.currentPassword);
    if (before.isSuperAdmin && dto.status && dto.status !== 'ACTIVE') throw new ForbiddenException('حساب مدیر ارشد را نمی‌توان غیرفعال کرد.');
    if (dto.employeeId) await this.access.assertEmployeeAccess(actor,dto.employeeId);
    if (dto.roleIds) await this.access.assertGrantableRoles(actor,dto.roleIds.filter(roleId=>!before.userRoles.some(row=>row.roleId===roleId)));
    if (dto.scope) await this.access.assertGrantableScopes(actor,dto.scope);
    const row = await this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await this.target(id,actor,db);
      await this.reauthenticateProtected(current,actor,dto.currentPassword,db);
      if (current.isSuperAdmin && dto.status && dto.status !== 'ACTIVE') throw new ForbiddenException('حساب مدیر ارشد را نمی‌توان غیرفعال کرد.');
      if (dto.roleIds) {
        await db.userRole.deleteMany({where:{userId:id}});
        await db.userRole.createMany({data:[...new Set(dto.roleIds)].map(roleId=>({userId:id,roleId,grantedById:actor.id}))});
      }
      if (dto.scope) {
        await db.scopeAssignment.deleteMany({where:{userId:id}});
        if (dto.scope.length) await db.scopeAssignment.createMany({data:dto.scope.map(scope=>({userId:id,...this.scopeData(scope)}))});
      }
      const updated = await db.user.update({where:{id},data:{
        ...(dto.fullName !== undefined ? {fullName:dto.fullName.trim()} : {}),...(dto.email !== undefined ? {email:dto.email} : {}),
        ...(dto.mobile !== undefined ? {mobile:dto.mobile} : {}),...(dto.employeeId !== undefined ? {employeeId:dto.employeeId} : {}),
        ...(dto.status !== undefined ? {status:dto.status} : {}),...(dto.mfaEnabled !== undefined ? {mfaEnabled:dto.mfaEnabled} : {}),
      },include:userInclude});
      if (dto.roleIds || dto.scope || dto.status || dto.employeeId !== undefined) await this.revoke(db,id);
      await this.record(db,actor.id,id,dto.roleIds || dto.scope ? AuditAction.PERMISSION_CHANGE : AuditAction.UPDATE,{status:updated.status,roleIds:dto.roleIds,scopeChanged:!!dto.scope});
      return updated;
    });
    return this.toPublic(row);
  }

  async deactivate(id: string, actor: AuthenticatedUser) {
    const row = await this.target(id,actor);
    if (this.protectedAccount(row)) throw new ForbiddenException('حساب محافظت‌شده را نمی‌توان غیرفعال کرد.');
    if (id === actor.id) throw new ForbiddenException('حساب خودتان را از این مسیر غیرفعال نکنید.');
    await this.prisma.$transaction(async db=>{
      await db.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await this.target(id,actor,db);
      if (this.protectedAccount(current)) throw new ForbiddenException('حساب محافظت‌شده را نمی‌توان غیرفعال کرد.');
      await db.user.update({where:{id},data:{status:UserStatus.INACTIVE,deletedAt:new Date()}});
      await this.revoke(db,id);
      await this.record(db,actor.id,id,AuditAction.DEACTIVATE,{status:'INACTIVE'});
    });
    return {success:true};
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actor: AuthenticatedUser) {
    const row = await this.target(id,actor);
    await this.reauthenticateProtected(row,actor,dto.currentPassword);
    const strength = validatePasswordStrength(dto.password,10);
    if (!strength.ok) throw new BadRequestException(strength.message);
    const passwordHash = await hashPassword(dto.password);
    await this.prisma.$transaction(async db=>{
      await db.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await this.target(id,actor,db);
      await this.reauthenticateProtected(current,actor,dto.currentPassword,db);
      await db.user.update({where:{id},data:{passwordHash,mustChangePassword:dto.mustChangePassword ?? true,passwordChangedAt:new Date(),failedLoginCount:0,lockedUntil:null}});
      await this.revoke(db,id);
      await this.record(db,actor.id,id,AuditAction.PASSWORD_CHANGE,{reset:true,protected:this.protectedAccount(row)});
    });
    return {success:true};
  }

  async revokeSessions(id: string, actor: AuthenticatedUser) {
    await this.target(id,actor);
    await this.prisma.$transaction(async db=>{
      await db.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      await this.target(id,actor,db);
      await this.revoke(db,id);
      await this.record(db,actor.id,id,AuditAction.LOGOUT,{revokedAll:true});
    });
    return {success:true};
  }

  private scopeData(scope: ScopeAssignmentDto) {
    return {scopeType:scope.scopeType,companyId:scope.companyId ?? null,branchId:scope.branchId ?? null,orgUnitId:scope.orgUnitId ?? null,employeeId:scope.employeeId ?? null};
  }

  private toPublic(row: UserRow) {
    return {
      id:row.id,username:row.username,fullName:row.fullName,email:row.email,mobile:row.mobile,status:row.status,
      isSuperAdmin:row.isSuperAdmin,isProtected:this.protectedAccount(row),mustChangePassword:row.mustChangePassword,mfaEnabled:row.mfaEnabled,
      lastLoginAt:row.lastLoginAt,createdAt:row.createdAt,employee:row.employee,
      roles:row.userRoles.map(item=>({id:item.role.id,code:item.role.code,name:item.role.name,validFrom:item.validFrom,validTo:item.validTo})),
      scope:row.scopeAssignments.map(item=>({id:item.id,scopeType:item.scopeType,companyId:item.companyId,branchId:item.branchId,orgUnitId:item.orgUnitId,employeeId:item.employeeId})),
    };
  }
}
