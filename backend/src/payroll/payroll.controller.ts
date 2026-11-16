import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuditService } from '../common/audit/audit.service';
import { PayrollService } from './payroll.service';
import {
  CreatePayComponentDto,
  CreatePayRuleVersionDto,
  CreatePayrollAmendmentDto,
  CreatePayrollPeriodDto,
  PayComponentQueryDto,
  PayrollCompareQueryDto,
  PayrollPeriodQueryDto,
  PayrollReportQueryDto,
  RejectPayrollAmendmentDto,
  UpdatePayComponentDto,
} from './dto/payroll.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('payroll')
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly service: PayrollService,
    private readonly audit: AuditService,
  ) {}

  // =========================================================================
  // مؤلفه‌های پرداخت
  // =========================================================================

  @Get('components')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'فهرست مؤلفه‌های پرداخت' })
  listComponents(@Query() query: PayComponentQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listComponents(query, pagination, user);
  }
  @Get('components/options')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'فهرست سبک مؤلفه‌ها برای dropdown' })
  componentOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.componentOptions(user);
  }
  @Post('components')
  @RequirePermissions(PERMISSIONS.PAYROLL_CREATE)
  @ApiOperation({ summary: 'ایجاد مؤلفه پرداخت' })
  createComponent(
    @Body() dto: CreatePayComponentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createComponent(dto, user.id, user);
  }
  @Patch('components/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_UPDATE)
  @ApiOperation({ summary: 'ویرایش مؤلفه پرداخت' })
  updateComponent(@Param('id') id: string, @Body() dto: UpdatePayComponentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateComponent(id, dto, user.id, user);
  }
  @Delete('components/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_UPDATE)
  @ApiOperation({ summary: 'غیرفعال‌سازی مؤلفه پرداخت' })
  deleteComponent(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteComponent(id, user.id, user);
  }
  @Post('components/:id/rule-versions')
  @RequirePermissions(PERMISSIONS.PAYROLL_UPDATE)
  @ApiOperation({ summary: 'ایجاد نسخه جدید قانون محاسبه' })
  createRuleVersion(
    @Param('id') componentId: string,
    @Body() dto: CreatePayRuleVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createRuleVersion(componentId, dto, user.id, user);
  }
  @Get('periods')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'فهرست دوره‌های حقوق' })
  listPeriods(@Query() query: PayrollPeriodQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listPeriods(query, pagination, user);
  }
  @Post('periods')
  @RequirePermissions(PERMISSIONS.PAYROLL_CREATE)
  @ApiOperation({ summary: 'ایجاد دوره حقوق' })
  createPeriod(@Body() dto: CreatePayrollPeriodDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createPeriod(dto, user.id, user);
  }
  @Post('periods/:id/generate')
  @RequirePermissions(PERMISSIONS.PAYROLL_CREATE)
  @ApiOperation({ summary: 'تولید خودکار کارکرد حقوق دوره' })
  generate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generate(id, user.id, user);
  }
  @Post('periods/:id/review')
  @RequirePermissions(PERMISSIONS.PAYROLL_REVIEW)
  @ApiOperation({ summary: 'بررسی دوره توسط حسابدار' })
  review(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.review(id, user.id, user);
  }
  @Post('periods/:id/lock')
  @RequirePermissions(PERMISSIONS.PAYROLL_APPROVE)
  @ApiOperation({ summary: 'قفل‌کردن دوره حقوق' })
  lock(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.lock(id, user.id, user);
  }
  @Post('periods/:id/publish')
  @RequirePermissions(PERMISSIONS.PAYROLL_PUBLISH)
  @ApiOperation({ summary: 'انتشار فیش‌های حقوق دوره' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.publish(id, user.id, user);
  }
  @Get('amendments')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'فهرست اصلاحات حقوق' })
  listAmendments(@Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listAmendments(pagination, user);
  }
  @Post('amendments')
  @RequirePermissions(PERMISSIONS.PAYROLL_UPDATE)
  @ApiOperation({ summary: 'ثبت درخواست اصلاح حقوق' })
  createAmendment(@Body() dto: CreatePayrollAmendmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createAmendment(dto, user.id, user);
  }
  @Post('amendments/:id/approve')
  @RequirePermissions(PERMISSIONS.PAYROLL_APPROVE)
  @ApiOperation({ summary: 'تأیید اصلاح حقوق' })
  approveAmendment(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approveAmendment(id, user.id, user);
  }
  @Post('amendments/:id/reject')
  @RequirePermissions(PERMISSIONS.PAYROLL_APPROVE)
  @ApiOperation({ summary: 'رد اصلاح حقوق' })
  rejectAmendment(
    @Param('id') id: string,
    @Body() dto: RejectPayrollAmendmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.rejectAmendment(id, dto, user.id, user);
  }
  @Get('components/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'جزئیات مؤلفه پرداخت' })
  getComponent(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getComponent(id, user);
  }
  @Get('components/:id/rule-versions')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'نسخه‌های قانون محاسبه مؤلفه' })
  listRuleVersions(@Param('id') componentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listRuleVersions(componentId, user);
  }
  @Get('periods/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'جزئیات دوره حقوق' })
  getPeriod(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getPeriod(id, user);
  }
  @Get('periods/:id/payslips')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'فیش‌های حقوق یک دوره' })
  listPayslips(
    @Param('id') periodId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listPayslips(periodId, user, pagination);
  }
  @Get('payslips/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'جزئیات فیش حقوق (ثبت لاگ مشاهده)' })
  getPayslip(@Param('id') payslipId: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.service.getPayslip(payslipId, user, this.audit.contextFrom(req));
  }
  @Get('me/payslip/:periodId')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW_OWN)
  @ApiOperation({ summary: 'فیش حقوق خودم برای دوره مشخص' })
  myPayslip(@Param('periodId') periodId: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.service.myPayslip(periodId, user, this.audit.contextFrom(req));
  }
  @Get('amendments/:id')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'جزئیات اصلاح حقوق' })
  getAmendment(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getAmendment(id, user);
  }
  @Get('periods/:id/report')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'گزارش حقوق دوره (JSON یا خروجی csv/xlsx)' })
  async report(
    @Param('id') periodId: string,
    @Query() query: PayrollReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result: any = await this.service.report(periodId, query, user, this.audit.contextFrom(req));
    if (result?.file) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(result.filename)}"`,
      );
      return res.send(result.buffer);
    }
    return res.json(result);
  }
  @Get('periods/:id/compare')
  @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  @ApiOperation({ summary: 'مقایسه دوره حقوق با دوره قبلی' })
  compare(
    @Param('id') periodId: string,
    @Query() query: PayrollCompareQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.compare(periodId, query, user);
  }
}
