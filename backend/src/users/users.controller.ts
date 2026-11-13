import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserQueryDto } from './dto/users.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { IdParamDto } from '../common/dto/common.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  @ApiOperation({ summary: 'فهرست کاربران سامانه' })
  list(@Query() query: UserQueryDto, @Query() pagination: PaginationDto) {
    return this.service.list(query, pagination);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @ApiOperation({ summary: 'ایجاد کاربر جدید' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  @ApiOperation({ summary: 'ویرایش کاربر، نقش‌ها و حوزه دسترسی' })
  update(@Param() params: IdParamDto, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(params.id, dto, user.id);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @ApiOperation({ summary: 'غیرفعال‌سازی کاربر و ابطال نشست‌ها' })
  deactivate(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deactivate(params.id, user.id);
  }
  @Post(':id/reset-password')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  @ApiOperation({ summary: 'بازنشانی رمز عبور کاربر' })
  resetPassword(
    @Param() params: IdParamDto,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resetPassword(params.id, dto, user.id);
  }
  @Post(':id/revoke-sessions')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE_SESSIONS)
  @ApiOperation({ summary: 'ابطال نشست‌های فعال کاربر' })
  revokeSessions(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.revokeSessions(params.id, user.id);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  @ApiOperation({ summary: 'جزئیات کاربر، نقش‌ها، حوزه دسترسی و نشست‌ها' })
  get(@Param() params: IdParamDto) {
    return this.service.get(params.id);
  }
}
