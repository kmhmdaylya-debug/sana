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
import { LifecycleService } from './lifecycle.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  ChecklistQueryDto,
  CreateOffboardingDto,
  CreateOnboardingTemplateDto,
  CreateTerminationRequestDto,
  DecideTerminationDto,
  OnboardingTemplateQueryDto,
  StartOnboardingDto,
  TerminationQueryDto,
  UpdateChecklistItemDto,
} from './dto/lifecycle.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('lifecycle')
@Controller('lifecycle')
export class LifecycleController {
  constructor(private readonly service: LifecycleService) {}

  // =========================================================================
  // قالب چک‌لیست ورود
  // =========================================================================

  @Get('templates')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_VIEW)
  @ApiOperation({ summary: 'فهرست قالب‌های چک‌لیست ورود' })
  listTemplates(@Query() query: OnboardingTemplateQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listTemplates(query, pagination, user);
  }
  @Post('templates')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'تعریف قالب چک‌لیست ورود' })
  createTemplate(@Body() dto: CreateOnboardingTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createTemplate(dto, user);
  }
  @Get('onboarding')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_VIEW)
  @ApiOperation({ summary: 'فهرست چک‌لیست‌های ورود' })
  listChecklists(@Query() query: ChecklistQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listChecklists(query, pagination, user);
  }
  @Post('onboarding')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'آغاز فرآیند ورود نیرو' })
  startOnboarding(@Body() dto: StartOnboardingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.startOnboarding(dto, user);
  }
  @Patch('onboarding/items/:itemId')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'ثبت وضعیت قلم چک‌لیست ورود' })
  updateChecklistItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateChecklistItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateChecklistItem(itemId, dto, user);
  }
  @Get('offboarding')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_VIEW)
  @ApiOperation({ summary: 'فهرست چک‌لیست‌های خروج' })
  listOffboarding(@Query() query: ChecklistQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listOffboarding(query, pagination, user);
  }
  @Post('offboarding')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'آغاز فرآیند خروج و تسویه' })
  startOffboarding(@Body() dto: CreateOffboardingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.startOffboarding(dto, user);
  }
  @Patch('offboarding/items/:itemId')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'ثبت وضعیت قلم چک‌لیست خروج' })
  updateOffboardingItem(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateChecklistItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateOffboardingItem(itemId, dto, user);
  }
  @Get('terminations')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_VIEW)
  @ApiOperation({ summary: 'فهرست درخواست‌های خاتمه' })
  listTerminations(@Query() query: TerminationQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listTerminations(query, pagination, user);
  }
  @Post('terminations')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'ثبت درخواست خاتمه همکاری' })
  createTermination(@Body() dto: CreateTerminationRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createTermination(dto, user);
  }
  @Post('terminations/:id/decide')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_MANAGE)
  @ApiOperation({ summary: 'تصمیم خاتمه (هیچ‌کس درخواست خودش را تأیید نمی‌کند)' })
  decideTermination(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideTerminationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decideTermination(id, dto, user);
  }
  @Get('onboarding/:id')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_VIEW)
  @ApiOperation({ summary: 'جزئیات چک‌لیست ورود' })
  getChecklist(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getChecklist(id, user);
  }
  @Get('offboarding/:id')
  @RequirePermissions(PERMISSIONS.LIFECYCLE_VIEW)
  @ApiOperation({ summary: 'جزئیات چک‌لیست خروج' })
  getOffboarding(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getOffboarding(id, user);
  }
}
