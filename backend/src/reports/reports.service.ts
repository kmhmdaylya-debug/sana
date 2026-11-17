import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, ReportStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccessService } from '../common/access/access.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { employeeVisibility } from '../employees/employee-privacy';
import { PaginationDto } from '../common/dto/pagination.dto';
import { jalaliToGregorian } from '../attendance/jalali.util';
import { buildExportBuffer, contentTypeFor, ExportColumn } from '../common/utils/export.util';
import { RunReportDto, ReportRunQueryDto } from './dto/reports.dto';

export interface ReportDefinition {
  code: string;
  title: string;
  description: string;
}

const REPORT_PERMISSIONS: Record<string, string> = {
  'employees.directory': 'employees.view', 'attendance.monthly': 'attendance.view',
  'leaves.summary': 'leaves.view', 'contracts.expiring': 'contracts.view', 'training.records': 'training.view',
};

const REPORT_DEFINITIONS: ReportDefinition[] = [
  { code: 'employees.directory', title: 'فهرست نیروها', description: 'مشخصات کامل نیروهای در حوزه دسترسی' },
  { code: 'attendance.monthly', title: 'خلاصه حضور ماهانه', description: 'کارکرد/غیبت هر نیرو در یک ماه شمسی' },
  { code: 'leaves.summary', title: 'خلاصه مرخصی‌ها', description: 'مرخصی‌های تأییدشده در بازه' },
  { code: 'contracts.expiring', title: 'قراردادهای در حال انقضا', description: 'قراردادهای منقضی‌شونده در ۹۰ روز' },
  { code: 'training.records', title: 'سوابق آموزش', description: 'دوره‌های گذرانده‌شده نیروها' },
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /** فهرست گزارش‌های قابل اجرا */
  listDefinitions(user: AuthenticatedUser) {
    const definitions = REPORT_DEFINITIONS.filter(item => this.access.hasPermission(user, REPORT_PERMISSIONS[item.code]));
    return {
      data: definitions.map(item => ({ ...item, needsMonth: item.code === 'attendance.monthly', needsDateRange: item.code === 'leaves.summary' })),
      meta: { total: definitions.length, page: 1, limit: definitions.length, totalPages: 1, hasNext: false, hasPrev: false },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تاریخچه اجرای گزارش‌ها */
  async listRuns(query: ReportRunQueryDto, pagination: PaginationDto, user: AuthenticatedUser) {
    const where: Prisma.ReportRunWhereInput = {
      userId: user.id,
      ...(query.reportCode ? { reportCode: query.reportCode } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.reportRun.count({ where }),
      this.prisma.reportRun.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * اجرای گزارش و تولید فایل CSV/XLSX.
   * خروجی سرویس برای کنترلر: { file: true, buffer, filename, contentType }
   */
  async run(dto: RunReportDto, user: AuthenticatedUser) {
    const definition = REPORT_DEFINITIONS.find((d) => d.code === dto.reportCode);
    if (!definition) throw new NotFoundException(`گزارش «${dto.reportCode}» یافت نشد.`);

    if (!this.access.hasPermission(user, REPORT_PERMISSIONS[dto.reportCode])) throw new ForbiddenException('مجوز مشاهده اطلاعات این گزارش را ندارید.');
    if (dto.companyId) await this.access.assertCompanyAccess(user, dto.companyId);
    if (dto.reportCode === 'attendance.monthly' && (!dto.year || !dto.month)) throw new BadRequestException('سال و ماه جلالی را انتخاب کنید.');
    if (dto.from && dto.to && new Date(dto.from) > new Date(dto.to)) throw new BadRequestException('بازه تاریخ معتبر نیست.');
    const run = await this.prisma.reportRun.create({
      data: {
        userId: user.id,
        reportCode: dto.reportCode,
        params: JSON.stringify({ from: dto.from, to: dto.to, year: dto.year, month: dto.month }),
        format: dto.format ?? 'csv',
        status: ReportStatus.RUNNING,
      },
    });

    try {
      const { columns, rows, filename } = await this.execute(dto, user);
      const buffer = await buildExportBuffer(dto.format ?? 'csv', definition.title, columns, rows);

      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: ReportStatus.DONE, rowCount: rows.length, finishedAt: new Date() },
      });

      await this.audit.record(user.id, {
        action: AuditAction.EXPORT,
        entity: 'ReportRun',
        entityId: run.id,
        after: { reportCode: dto.reportCode, rows: rows.length },
      });

      return {
        file: true,
        buffer,
        filename,
        contentType: contentTypeFor(dto.format ?? 'csv'),
      };
    } catch (err: any) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: ReportStatus.FAILED, error: 'تولید گزارش ناموفق بود.', finishedAt: new Date() },
      });
      throw err;
    }
  }

  private async execute(dto: RunReportDto, user: AuthenticatedUser): Promise<{
    columns: ExportColumn[];
    rows: Record<string, unknown>[];
    filename: string;
  }> {
    switch (dto.reportCode) {
      case 'employees.directory':
        return this.reportEmployeesDirectory(dto, user);
      case 'attendance.monthly':
        return this.reportAttendanceMonthly(dto, user);
      case 'leaves.summary':
        return this.reportLeavesSummary(dto, user);
      case 'contracts.expiring':
        return this.reportContractsExpiring(dto, user);
      case 'training.records':
        return this.reportTrainingRecords(dto, user);
      default:
        throw new BadRequestException('کد گزارش پشتیبانی نمی‌شود.');
    }
  }

  // -------------------------------------------------------------------------
  // گزارش‌ها
  // -------------------------------------------------------------------------

  private async reportEmployeesDirectory(dto: RunReportDto, user: AuthenticatedUser) {
    const rows = await this.prisma.employee.findMany({
      where: { deletedAt: null, AND: [this.reportEmployeeWhere(dto, user)] },
      include: {
        company: { select: { code: true, name: true } },
        branch: { select: { name: true } },
        orgUnit: { select: { name: true } },
        position: { select: { title: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: { code: 'asc' },
      take: 5001,
    });
    this.assertExportLimit(rows.length, 5000);

    return {
      columns: [
        { header: 'کد پرسنلی', key: 'code', width: 14 },
        { header: 'نام', key: 'firstName' },
        { header: 'نام خانوادگی', key: 'lastName' },
        ...(employeeVisibility(user).personal ? [{ header: 'کد ملی', key: 'nationalId' }] : []),
        { header: 'شرکت', key: 'company' },
        { header: 'شعبه', key: 'branch' },
        { header: 'واحد سازمانی', key: 'orgUnit' },
        { header: 'سمت', key: 'position' },
        { header: 'نوع استخدام', key: 'employmentType' },
        { header: 'تاریخ استخدام', key: 'hireDate', date: true },
        { header: 'وضعیت', key: 'status' },
        ...(employeeVisibility(user).personal ? [{ header: 'موبایل', key: 'mobile' }] : []),
      ] satisfies ExportColumn[],
      rows: rows.map((e) => ({
        code: e.code,
        firstName: e.firstName,
        lastName: e.lastName,
        ...(employeeVisibility(user).personal ? { nationalId: e.nationalId ?? '' } : {}),
        company: e.company?.name ?? '',
        branch: e.branch?.name ?? '',
        orgUnit: e.orgUnit?.name ?? '',
        position: e.position?.title ?? '',
        employmentType: e.employmentType,
        hireDate: e.hireDate,
        status: e.status,
        ...(employeeVisibility(user).personal ? { mobile: e.mobile ?? '' } : {}),
      })),
      filename: `employees-directory-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  private async reportAttendanceMonthly(dto: RunReportDto, user: AuthenticatedUser) {
    const year = dto.year!;
    const month = dto.month!;
    const { start, end } = await this.jalaliMonthBounds(year, month);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        workDate: { gte: start, lt: end },
        employee: this.reportEmployeeWhere(dto, user),
      },
      include: {
        employee: { select: { code: true, firstName: true, lastName: true } },
      },
      take: 20001,
    });
    this.assertExportLimit(records.length, 20000);

    const byEmployee = new Map<string, {
      employee: { code: string; firstName: string; lastName: string };
      workedMinutes: number;
      absentDays: number;
      days: number;
    }>();

    for (const r of records) {
      const key = r.employeeId;
      const entry = byEmployee.get(key) ?? {
        employee: r.employee,
        workedMinutes: 0,
        absentDays: 0,
        days: 0,
      };
      entry.days += 1;
      entry.workedMinutes += r.workMinutes ?? 0;
      if (r.status === 'ABSENT') entry.absentDays += 1;
      byEmployee.set(key, entry);
    }

    return {
      columns: [
        { header: 'کد پرسنلی', key: 'code', width: 14 },
        { header: 'نام', key: 'firstName' },
        { header: 'نام خانوادگی', key: 'lastName' },
        { header: 'روزهای کارکرد', key: 'days' },
        { header: 'دقیقه کارکرد', key: 'workedMinutes' },
        { header: 'ساعت کارکرد', key: 'workedHours' },
        { header: 'روزهای غیبت', key: 'absentDays' },
      ] satisfies ExportColumn[],
      rows: [...byEmployee.values()].map((e) => ({
        code: e.employee.code,
        firstName: e.employee.firstName,
        lastName: e.employee.lastName,
        days: e.days,
        workedMinutes: e.workedMinutes,
        workedHours: Math.round((e.workedMinutes / 60) * 10) / 10,
        absentDays: e.absentDays,
      })),
      filename: `attendance-${year}-${month}`,
    };
  }

  private async reportLeavesSummary(dto: RunReportDto, user: AuthenticatedUser) {
    const from = dto.from ? new Date(`${dto.from}T00:00:00.000Z`) : new Date(Date.now() - 90 * 86_400_000);
    const to = dto.to ? new Date(`${dto.to}T23:59:59.999Z`) : new Date();

    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startAt: { gte: from, lte: to },
        employee: this.reportEmployeeWhere(dto, user),
      },
      include: {
        employee: { select: { code: true, firstName: true, lastName: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startAt: 'desc' },
      take: 5001,
    });
    this.assertExportLimit(rows.length, 5000);

    return {
      columns: [
        { header: 'کد پرسنلی', key: 'code', width: 14 },
        { header: 'نام', key: 'firstName' },
        { header: 'نام خانوادگی', key: 'lastName' },
        { header: 'نوع مرخصی', key: 'leaveType' },
        { header: 'از', key: 'startAt', date: true },
        { header: 'تا', key: 'endAt', date: true },
        { header: 'ساعت', key: 'hours' },
        ...(employeeVisibility(user).personal ? [{ header: 'دلیل', key: 'reason' }] : []),
      ] satisfies ExportColumn[],
      rows: rows.map((r) => ({
        code: r.employee.code,
        firstName: r.employee.firstName,
        lastName: r.employee.lastName,
        leaveType: r.leaveType.name,
        startAt: r.startAt,
        endAt: r.endAt,
        hours: Math.round((r.durationMinutes / 60) * 10) / 10,
        ...(employeeVisibility(user, r.employeeId).personal ? { reason: r.reason ?? '' } : {}),
      })),
      filename: `leaves-${dto.from ?? 'all'}-${dto.to ?? ''}`,
    };
  }

  private async reportContractsExpiring(dto: RunReportDto, user: AuthenticatedUser) {
    const to = new Date();
    to.setDate(to.getDate() + 90);
    const from = new Date();

    const contracts = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'EXPIRING', 'RENEWED'] },
        employee: this.reportEmployeeWhere(dto, user),
        versions: { some: { endDate: { gte: from, lte: to } } },
      },
      include: {
        employee: { select: { code: true, firstName: true, lastName: true } },
        versions: { where: { approvedAt: { not: null } }, orderBy: [{ effectiveDate: 'desc' }, { version: 'desc' }], take: 1 },
      },
      take: 5001,
    });
    this.assertExportLimit(contracts.length, 5000);

    return {
      columns: [
        { header: 'کد پرسنلی', key: 'code', width: 14 },
        { header: 'نام', key: 'firstName' },
        { header: 'نام خانوادگی', key: 'lastName' },
        { header: 'وضعیت قرارداد', key: 'status' },
        { header: 'تاریخ پایان', key: 'endDate', date: true },
      ] satisfies ExportColumn[],
      rows: contracts.filter(c => c.versions[0]?.endDate && c.versions[0].endDate >= from && c.versions[0].endDate <= to).map((c) => ({
        code: c.employee.code,
        firstName: c.employee.firstName,
        lastName: c.employee.lastName,
        status: c.status,
        endDate: c.versions[0]?.endDate ?? null,
      })),
      filename: `contracts-expiring-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  private async reportTrainingRecords(dto: RunReportDto, user: AuthenticatedUser) {
    const rows = await this.prisma.trainingRecord.findMany({
      where: { employee: this.reportEmployeeWhere(dto, user) },
      include: {
        employee: { select: { code: true, firstName: true, lastName: true } },
        course: { select: { code: true, title: true } },
      },
      orderBy: { attendanceDate: 'desc' },
      take: 5001,
    });
    this.assertExportLimit(rows.length, 5000);

    return {
      columns: [
        { header: 'کد پرسنلی', key: 'code', width: 14 },
        { header: 'نام', key: 'firstName' },
        { header: 'نام خانوادگی', key: 'lastName' },
        { header: 'کد دوره', key: 'courseCode' },
        { header: 'عنوان دوره', key: 'courseTitle' },
        { header: 'تاریخ حضور', key: 'attendanceDate', date: true },
        { header: 'نتیجه', key: 'result' },
        { header: 'امتیاز', key: 'score' },
      ] satisfies ExportColumn[],
      rows: rows.map((r) => ({
        code: r.employee.code,
        firstName: r.employee.firstName,
        lastName: r.employee.lastName,
        courseCode: r.course.code,
        courseTitle: r.course.title,
        attendanceDate: r.attendanceDate,
        result: r.result ?? '',
        score: r.score ?? '',
      })),
      filename: `training-records-${new Date().toISOString().slice(0, 10)}`,
    };
  }

  private reportEmployeeWhere(dto: RunReportDto, user: AuthenticatedUser): Prisma.EmployeeWhereInput {
    return { AND: [this.access.employeeWhereFor(user)], ...(dto.companyId ? { companyId: dto.companyId } : {}), ...(dto.orgUnitId ? { orgUnitId: dto.orgUnitId } : {}) };
  }

  private assertExportLimit(count: number, limit: number) {
    if (count > limit) throw new BadRequestException('تعداد نتایج گزارش از حد مجاز بیشتر است؛ شرکت، واحد یا بازه تاریخ را محدود کنید. هیچ فایل ناقصی تولید نشد.');
  }

  /** مرز ماه شمسی (میلی‌مبدأ محلی) */
  private async jalaliMonthBounds(year: number, month: number) {
    const startJ = jalaliToGregorian(year, month, 1);
    const nextY = month === 12 ? year + 1 : year;
    const nextM = month === 12 ? 1 : month + 1;
    const endJ = jalaliToGregorian(nextY, nextM, 1);
    return {
      start: new Date(Date.UTC(startJ.getFullYear(), startJ.getMonth(), startJ.getDate())),
      end: new Date(Date.UTC(endJ.getFullYear(), endJ.getMonth(), endJ.getDate())),
    };
  }
}
