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
import { RecruitmentService } from './recruitment.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  ApplicantQueryDto,
  CreateApplicantDto,
  CreateInterviewDto,
  CreateInterviewFeedbackDto,
  CreateOfferDto,
  CreateOpeningDto,
  CreateRequisitionDto,
  OfferQueryDto,
  OpeningQueryDto,
  RequisitionQueryDto,
  UpdateApplicantStatusDto,
  UpdateInterviewDto,
  UpdateOfferStatusDto,
  UpdateRequisitionStatusDto,
} from './dto/recruitment.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('recruitment')
@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly service: RecruitmentService) {}

  // =========================================================================
  // درخواست جذب
  // =========================================================================

  @Get('requisitions')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_VIEW)
  @ApiOperation({ summary: 'فهرست درخواست‌های جذب' })
  listRequisitions(@Query() query: RequisitionQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listRequisitions(query, pagination, user);
  }
  @Post('requisitions')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_MANAGE)
  @ApiOperation({ summary: 'ثبت درخواست جذب' })
  createRequisition(@Body() dto: CreateRequisitionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createRequisition(dto, user);
  }
  @Patch('requisitions/:id/status')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_MANAGE)
  @ApiOperation({ summary: 'تغییر وضعیت درخواست جذب (هیچ‌کس درخواست خودش را تأیید نمی‌کند)' })
  setRequisitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequisitionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setRequisitionStatus(id, dto.status, user);
  }
  @Get('openings')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_VIEW)
  @ApiOperation({ summary: 'فهرست آگهی‌های استخدام' })
  listOpenings(@Query() query: OpeningQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listOpenings(query, pagination, user);
  }
  @Post('openings')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_MANAGE)
  @ApiOperation({ summary: 'ثبت آگهی استخدام' })
  createOpening(@Body() dto: CreateOpeningDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createOpening(dto, user);
  }
  @Get('applicants')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_VIEW)
  @ApiOperation({ summary: 'فهرست داوطلبان' })
  listApplicants(@Query() query: ApplicantQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listApplicants(query, pagination, user);
  }
  @Post('applicants')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_MANAGE)
  @ApiOperation({ summary: 'ثبت داوطلب جدید' })
  createApplicant(@Body() dto: CreateApplicantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createApplicant(dto, user);
  }
  @Patch('applicants/:id/status')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_MANAGE)
  @ApiOperation({ summary: 'تغییر مرحله داوطلب' })
  setApplicantStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicantStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.setApplicantStatus(id, dto, user);
  }
  @Get('interviews')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_VIEW)
  @ApiOperation({ summary: 'فهرست مصاحبه‌ها' })
  listInterviews(@Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser, @Query('applicantId') applicantId?: string) {
    return this.service.listInterviews(pagination, user, applicantId);
  }
  @Post('interviews')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_INTERVIEW)
  @ApiOperation({ summary: 'زمان‌بندی مصاحبه' })
  createInterview(@Body() dto: CreateInterviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createInterview(dto, user);
  }
  @Patch('interviews/:id')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_INTERVIEW)
  @ApiOperation({ summary: 'به‌روزرسانی نتیجه/وضعیت مصاحبه' })
  updateInterview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInterviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateInterview(id, dto, user);
  }
  @Post('interviews/:id/feedback')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_INTERVIEW)
  @ApiOperation({ summary: 'ثبت بازخورد مصاحبه' })
  addFeedback(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateInterviewFeedbackDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addFeedback(id, dto, user);
  }
  @Get('offers')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_VIEW)
  @ApiOperation({ summary: 'فهرست پیشنهادهای استخدام' })
  listOffers(@Query() query: OfferQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listOffers(query, pagination, user);
  }
  @Post('offers')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_MANAGE)
  @ApiOperation({ summary: 'صدور پیشنهاد استخدام' })
  createOffer(@Body() dto: CreateOfferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createOffer(dto, user);
  }
  @Patch('offers/:id/status')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_MANAGE)
  @ApiOperation({ summary: 'تغییر وضعیت پیشنهاد' })
  setOfferStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.setOfferStatus(id, dto, user);
  }
  @Get('applicants/:id')
  @RequirePermissions(PERMISSIONS.RECRUITMENT_VIEW)
  @ApiOperation({ summary: 'پرونده کامل داوطلب' })
  getApplicant(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getApplicant(id, user);
  }
}
