import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateBankAccountDto,
  CreateDependentDto,
  CreateEmployeeDto,
  CreateEmploymentEventDto,
  CreateSkillDto,
  EmployeeQueryDto,
  UpdateEmployeeDto,
} from './dto/employees.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_VIEW)
  @ApiOperation({ summary: 'فهرست نیروها' })
  list(@Query() query: EmployeeQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }
  @Get('export-options')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_EXPORT)
  @ApiOperation({ summary: 'داده سبک نیروها برای خروجی' })
  exportOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.exportOptions(user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEES_CREATE)
  @ApiOperation({ summary: 'ایجاد نیرو' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'ویرایش نیرو' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_DELETE)
  @ApiOperation({ summary: 'حذف منطقی نیرو' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, undefined, user);
  }
  @Post(':id/dependents')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'افزودن تحت تکفل' })
  addDependent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDependentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addDependent(id, dto, user);
  }
  @Delete('dependents/:dependentId')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'حذف تحت تکفل' })
  removeDependent(@Param('dependentId', ParseUUIDPipe) dependentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeDependent(dependentId, user);
  }
  @Post(':id/skills')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'افزودن مهارت' })
  addSkill(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSkillDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addSkill(id, dto, user);
  }
  @Delete('skills/:skillId')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'حذف مهارت' })
  removeSkill(@Param('skillId', ParseUUIDPipe) skillId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeSkill(skillId, user);
  }
  @Post(':id/bank-accounts')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'افزودن حساب بانکی' })
  addBankAccount(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateBankAccountDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addBankAccount(id, dto, user);
  }
  @Delete('bank-accounts/:accountId')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'حذف حساب بانکی' })
  removeBankAccount(@Param('accountId', ParseUUIDPipe) accountId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeBankAccount(accountId, user);
  }
  @Post(':id/employment-events')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_UPDATE)
  @ApiOperation({ summary: 'ثبت رخداد استخدامی' })
  addEmploymentEvent(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateEmploymentEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addEmploymentEvent(id, dto, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_VIEW)
  @ApiOperation({ summary: 'جزئیات نیرو (لاگ مشاهده ثبت می‌شود)' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
  @Get(':id/dependents')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_VIEW)
  @ApiOperation({ summary: 'افراد تحت تکفل' })
  listDependents(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listDependents(id, user);
  }
  @Get(':id/skills')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_VIEW)
  @ApiOperation({ summary: 'مهارت‌های نیرو' })
  listSkills(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listSkills(id, user);
  }
  @Get(':id/bank-accounts')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_VIEW)
  @ApiOperation({ summary: 'حساب‌های بانکی' })
  listBankAccounts(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listBankAccounts(id, user);
  }
  @Get(':id/employment-events')
  @RequirePermissions(PERMISSIONS.EMPLOYEES_VIEW)
  @ApiOperation({ summary: 'رخدادهای استخدامی نیرو' })
  listEmploymentEvents(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listEmploymentEvents(id, user);
  }
}
