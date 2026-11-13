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
import { SettingsService } from './settings.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateCustomFieldDto,
  CreateSavedFilterDto,
  CustomFieldQueryDto,
  SettingQueryDto,
} from './dto/settings.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  // =========================================================================
  // تنظیمات سیستمی
  // =========================================================================

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @ApiOperation({ summary: 'فهرست تنظیمات' })
  listSettings(@Query() query: SettingQueryDto, @Query() pagination: PaginationDto) {
    return this.service.listSettings(query, pagination);
  }

  @Get('groups')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @ApiOperation({ summary: 'گروه‌های تنظیمات' })
  settingGroups() {
    return this.service.settingGroups();
  }

  @Patch(':key')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'به‌روزرسانی مقدار تنظیم' })
  updateSetting(@Param('key') key: string, @Body('value') value: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateSetting(key, value, user);
  }

  // =========================================================================
  // فیلدهای سفارشی
  // =========================================================================

  @Get('custom-fields')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @ApiOperation({ summary: 'فهرست فیلدهای سفارشی' })
  listCustomFields(@Query() query: CustomFieldQueryDto, @Query() pagination: PaginationDto) {
    return this.service.listCustomFields(query, pagination);
  }

  @Post('custom-fields')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'تعریف فیلد سفارشی' })
  createCustomField(@Body() dto: CreateCustomFieldDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCustomField(dto, user);
  }

  @Delete('custom-fields/:id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'غیرفعال‌سازی فیلد سفارشی' })
  removeCustomField(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeCustomField(id, user);
  }

  // =========================================================================
  // فیلترهای ذخیره‌شده
  // =========================================================================

  @Get('saved-filters')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @ApiOperation({ summary: 'فیلترهای ذخیره‌شده من' })
  listSavedFilters(@Query('scope') scope?: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.service.listSavedFilters({ scope }, user as AuthenticatedUser);
  }

  @Post('saved-filters')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @ApiOperation({ summary: 'ذخیره فیلتر جست‌وجو' })
  createSavedFilter(@Body() dto: CreateSavedFilterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createSavedFilter(dto, user);
  }

  @Delete('saved-filters/:id')
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  @ApiOperation({ summary: 'حذف فیلتر ذخیره‌شده' })
  removeSavedFilter(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeSavedFilter(id, user);
  }
}
