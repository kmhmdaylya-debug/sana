import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { IdParamDto } from '../common/dto/common.dto';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  @ApiOperation({ summary: 'فهرست نقش‌ها همراه با مجوزها' })
  list() {
    return this.service.list(true);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  @ApiOperation({ summary: 'فهرست مجوزها به تفکیک گروه' })
  permissions() {
    return this.service.permissions();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'ایجاد نقش با مجوزهای دلخواه' })
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'ویرایش نقش و مجوزهای آن' })
  update(@Param() params: IdParamDto, @Body() dto: UpdateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(params.id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'حذف نقش (نقش سیستمی قابل حذف نیست)' })
  remove(@Param() params: IdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(params.id, user.id);
  }
}
