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
import { AssetsService } from './assets.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AssetQueryDto,
  CreateAssetDto,
  CreateDepreciationDto,
  CreateHandoverDto,
  CreateMaintenanceDto,
  UpdateAssetDto,
} from './dto/assets.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'فهرست دارایی‌ها' })
  list(@Query() query: AssetQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'ثبت دارایی' })
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'ویرایش دارایی' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'حذف منطقی دارایی' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
  @Post('handovers')
  @RequirePermissions(PERMISSIONS.ASSETS_HANDOVER)
  @ApiOperation({ summary: 'تحویل/بازپس‌گیری/انتقال دارایی' })
  handover(@Body() dto: CreateHandoverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.handover(dto, user);
  }
  @Post(':id/maintenances')
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'ثبت تعمیر/نگهداشت' })
  addMaintenance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMaintenanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addMaintenance(id, dto, user);
  }
  @Post(':id/depreciations')
  @RequirePermissions(PERMISSIONS.ASSETS_MANAGE)
  @ApiOperation({ summary: 'ثبت استهلاک دوره' })
  addDepreciation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDepreciationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addDepreciation(id, dto, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'جزئیات دارایی با سوابق' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
