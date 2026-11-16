import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  ConfidentialReportQueryDto,
  CreateConfidentialReportDto,
  CreateCorrespondenceDto,
  CreateMeetingDto,
  CreateReferralDto,
  CreateSuggestionDto,
  CreateSurveyDto,
  CorrespondenceQueryDto,
  DecideSuggestionDto,
  MeetingActionDto,
  MeetingQueryDto,
  RespondReferralDto,
  SuggestionQueryDto,
  SubmitSurveyResponseDto,
  SurveyQueryDto,
  UpdateConfidentialReportDto,
  UpdateCorrespondenceDto,
  UpdateMeetingDto,
  UpdateSurveyDto,
} from './dto/admin.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // =========================================================================
  // مکاتبات
  // =========================================================================

  @Get('correspondences')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'فهرست نامه‌های اداری' })
  listCorrespondences(@Query() query: CorrespondenceQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listCorrespondences(query, pagination, user);
  }
  @Post('correspondences')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'ثبت نامه اداری' })
  createCorrespondence(@Body() dto: CreateCorrespondenceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCorrespondence(dto, user);
  }
  @Patch('correspondences/:id')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'به‌روزرسانی وضعیت نامه' })
  updateCorrespondence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCorrespondenceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateCorrespondence(id, dto, user);
  }
  @Post('correspondences/:id/referrals')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'ارجاع نامه' })
  referCorrespondence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReferralDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.referCorrespondence(id, dto, user);
  }
  @Post('referrals/:referralId/respond')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'پاسخ به ارجاع دریافتی' })
  respondReferral(@Param('referralId', ParseUUIDPipe) referralId: string, @Body() dto: RespondReferralDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.respondReferral(referralId, dto, user);
  }
  @Get('meetings')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'فهرست جلسات' })
  listMeetings(@Query() query: MeetingQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listMeetings(query, pagination, user);
  }
  @Post('meetings')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'برگزاری/تعریف جلسه' })
  createMeeting(@Body() dto: CreateMeetingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createMeeting(dto, user);
  }
  @Patch('meetings/:id')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'به‌روزرسانی جلسه (صورتجلسه/وضعیت)' })
  updateMeeting(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeetingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateMeeting(id, dto, user);
  }
  @Post('meetings/:id/actions')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'ثبت مصوبه جلسه' })
  addMeetingAction(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MeetingActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addMeetingAction(id, dto, user);
  }
  @Post('meeting-actions/:actionId/complete')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'تکمیل مصوبه' })
  completeMeetingAction(@Param('actionId', ParseUUIDPipe) actionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.completeMeetingAction(actionId, user);
  }
  @Get('surveys')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'فهرست نظرسنجی‌ها' })
  listSurveys(@Query() query: SurveyQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listSurveys(query, pagination, user);
  }
  @Post('surveys')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'طراحی نظرسنجی با سؤالات' })
  createSurvey(@Body() dto: CreateSurveyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createSurvey(dto, user);
  }
  @Patch('surveys/:id')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'تغییر وضعیت/بازه نظرسنجی' })
  updateSurvey(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSurveyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateSurvey(id, dto, user);
  }
  @Post('surveys/:id/responses')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'ثبت پاسخ نظرسنجی' })
  submitSurveyResponse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitSurveyResponseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.submitSurveyResponse(id, dto, user);
  }
  @Get('suggestions')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'فهرست پیشنهادها' })
  listSuggestions(@Query() query: SuggestionQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listSuggestions(query, pagination, user);
  }
  @Post('suggestions')
  @RequirePermissions(PERMISSIONS.ADMIN_VIEW)
  @ApiOperation({ summary: 'ثبت پیشنهاد (امکان ارسال ناشناس)' })
  createSuggestion(@Body() dto: CreateSuggestionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createSuggestion(dto, user);
  }
  @Patch('suggestions/:id')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'تصمیم/تعیین مسئول پیشنهاد' })
  decideSuggestion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideSuggestionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decideSuggestion(id, dto, user);
  }
  @Get('confidential-reports')
  @RequirePermissions(PERMISSIONS.CONFIDENTIAL_REPORTS_MANAGE)
  @ApiOperation({ summary: 'فهرست گزارش‌های محرمانه' })
  listConfidentialReports(@Query() query: ConfidentialReportQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listConfidentialReports(query, pagination, user);
  }
  @Post('confidential-reports')
  @RequirePermissions(PERMISSIONS.CONFIDENTIAL_REPORTS_MANAGE)
  @ApiOperation({ summary: 'ثبت گزارش محرمانه' })
  createConfidentialReport(@Body() dto: CreateConfidentialReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createConfidentialReport(dto, user);
  }
  @Patch('confidential-reports/:id')
  @RequirePermissions(PERMISSIONS.CONFIDENTIAL_REPORTS_MANAGE)
  @ApiOperation({ summary: 'به‌روزرسانی بررسی گزارش' })
  updateConfidentialReport(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConfidentialReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateConfidentialReport(id, dto, user);
  }
  @Get('surveys/:id/results')
  @RequirePermissions(PERMISSIONS.ADMIN_MANAGE)
  @ApiOperation({ summary: 'نتایج نظرسنجی' })
  surveyResults(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.surveyResults(id, user);
  }
}
