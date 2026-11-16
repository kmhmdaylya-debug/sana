import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgService } from './org.service';
import {
  BranchQueryDto,
  BulkCreateHolidayDto,
  CalendarQueryDto,
  CompanyQueryDto,
  CostCenterQueryDto,
  CreateBranchDto,
  CreateCalendarDto,
  CreateCompanyDto,
  CreateCostCenterDto,
  CreateOrgUnitDto,
  CreatePositionDto,
  CreateWorkLocationDto,
  HolidayQueryDto,
  IdParamDto,
  OrgTreeQueryDto,
  OrgUnitQueryDto,
  PositionQueryDto,
  UpdateBranchDto,
  UpdateCalendarDto,
  UpdateCompanyDto,
  UpdateCostCenterDto,
  UpdateOrgUnitDto,
  UpdatePositionDto,
  UpdateWorkLocationDto,
  WorkLocationQueryDto,
} from './dto/org.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('org')
@Controller('org')
export class OrgController {
  constructor(private readonly service: OrgService) {}

  // =========================================================================
  // شرکت
  // =========================================================================

  @Get('companies')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست شرکت‌ها' })
  listCompanies(@Query() query: CompanyQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listCompanies(query, user);
  }
  @Get('companies/options')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست سبک شرکت‌ها برای dropdown' })
  companyOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.companyOptions(user);
  }
  @Post('companies')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ایجاد شرکت' })
  createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCompany(dto, user);
  }
  @Patch('companies/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ویرایش شرکت' })
  updateCompany(
    @Param() params: IdParamDto,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateCompany(params.id, dto, user);
  }
  @Delete('companies/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'حذف منطقی شرکت' })
  deleteCompany(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteCompany(params.id, user);
  }
  @Get('branches')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست شعبه‌ها' })
  listBranches(@Query() query: BranchQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listBranches(query, user);
  }
  @Get('branches/options')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست سبک شعبه‌ها برای dropdown' })
  branchOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.branchOptions(user);
  }
  @Post('branches')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ایجاد شعبه' })
  createBranch(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBranch(dto, user);
  }
  @Patch('branches/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ویرایش شعبه' })
  updateBranch(
    @Param() params: IdParamDto,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateBranch(params.id, dto, user);
  }
  @Delete('branches/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'حذف منطقی شعبه' })
  deleteBranch(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteBranch(params.id, user);
  }
  @Get('work-locations')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست محل‌های کار' })
  listWorkLocations(@Query() query: WorkLocationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listWorkLocations(query, user);
  }
  @Post('work-locations')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ایجاد محل کار' })
  createWorkLocation(@Body() dto: CreateWorkLocationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createWorkLocation(dto, user);
  }
  @Patch('work-locations/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ویرایش محل کار' })
  updateWorkLocation(
    @Param() params: IdParamDto,
    @Body() dto: UpdateWorkLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateWorkLocation(params.id, dto, user);
  }
  @Delete('work-locations/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'غیرفعال‌سازی محل کار' })
  deleteWorkLocation(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteWorkLocation(params.id, user);
  }
  @Get('cost-centers')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست مراکز هزینه' })
  listCostCenters(@Query() query: CostCenterQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listCostCenters(query, user);
  }
  @Post('cost-centers')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ایجاد مرکز هزینه' })
  createCostCenter(@Body() dto: CreateCostCenterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCostCenter(dto, user);
  }
  @Patch('cost-centers/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ویرایش مرکز هزینه' })
  updateCostCenter(
    @Param() params: IdParamDto,
    @Body() dto: UpdateCostCenterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateCostCenter(params.id, dto, user);
  }
  @Delete('cost-centers/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'غیرفعال‌سازی مرکز هزینه' })
  deleteCostCenter(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteCostCenter(params.id, user);
  }
  @Get('units')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست واحدهای سازمانی' })
  listOrgUnits(@Query() query: OrgUnitQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listOrgUnits(query, user);
  }
  @Get('units/options')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست سبک واحدهای سازمانی برای dropdown' })
  orgUnitOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.orgUnitOptions(user);
  }
  @Get('tree')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'درخت سازمانی (واحدهای تودرتو)' })
  orgTree(@Query() query: OrgTreeQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.orgTree(query, user);
  }
  @Post('units')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ایجاد واحد سازمانی' })
  createOrgUnit(@Body() dto: CreateOrgUnitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createOrgUnit(dto, user);
  }
  @Patch('units/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ویرایش واحد سازمانی' })
  updateOrgUnit(
    @Param() params: IdParamDto,
    @Body() dto: UpdateOrgUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateOrgUnit(params.id, dto, user);
  }
  @Delete('units/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'حذف منطقی واحد سازمانی' })
  deleteOrgUnit(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteOrgUnit(params.id, user);
  }
  @Get('positions')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست سمت‌های سازمانی' })
  listPositions(@Query() query: PositionQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listPositions(query, user);
  }
  @Get('positions/options')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست سبک سمت‌های سازمانی برای dropdown' })
  positionOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.positionOptions(user);
  }
  @Post('positions')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ایجاد سمت سازمانی' })
  createPosition(@Body() dto: CreatePositionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createPosition(dto, user);
  }
  @Patch('positions/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ویرایش سمت سازمانی' })
  updatePosition(
    @Param() params: IdParamDto,
    @Body() dto: UpdatePositionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updatePosition(params.id, dto, user);
  }
  @Delete('positions/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'غیرفعال‌سازی سمت سازمانی' })
  deletePosition(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deletePosition(params.id, user);
  }
  @Get('calendars')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست تقویم‌های کاری' })
  listCalendars(@Query() query: CalendarQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listCalendars(query, user);
  }
  @Post('calendars')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ایجاد تقویم کاری' })
  createCalendar(@Body() dto: CreateCalendarDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCalendar(dto, user);
  }
  @Patch('calendars/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ویرایش تقویم کاری' })
  updateCalendar(
    @Param() params: IdParamDto,
    @Body() dto: UpdateCalendarDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateCalendar(params.id, dto, user);
  }
  @Delete('calendars/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'حذف تقویم کاری و تعطیلات آن' })
  deleteCalendar(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteCalendar(params.id, user);
  }
  @Get('holidays')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'فهرست تعطیلات بر اساس تقویم و بازهٔ تاریخ' })
  listHolidays(@Query() query: HolidayQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listHolidays(query, user);
  }
  @Post('holidays')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'ثبت گروهی تعطیلات' })
  bulkCreateHolidays(@Body() dto: BulkCreateHolidayDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.bulkCreateHolidays(dto, user);
  }
  @Delete('holidays/:id')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  @ApiOperation({ summary: 'حذف تعطیلی' })
  deleteHoliday(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteHoliday(params.id, user);
  }
  @Get('companies/:id')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'جزئیات شرکت' })
  getCompany(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getCompany(params.id, user);
  }
  @Get('branches/:id')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'جزئیات شعبه' })
  getBranch(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getBranch(params.id, user);
  }
  @Get('work-locations/:id')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'جزئیات محل کار' })
  getWorkLocation(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getWorkLocation(params.id, user);
  }
  @Get('cost-centers/:id')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'جزئیات مرکز هزینه' })
  getCostCenter(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getCostCenter(params.id, user);
  }
  @Get('units/:id')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'جزئیات واحد سازمانی' })
  getOrgUnit(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getOrgUnit(params.id, user);
  }
  @Get('positions/:id')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'جزئیات سمت سازمانی' })
  getPosition(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getPosition(params.id, user);
  }
  @Get('calendars/:id')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'جزئیات تقویم کاری' })
  getCalendar(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getCalendar(params.id, user);
  }
}
