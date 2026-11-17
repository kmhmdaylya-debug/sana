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
import { LeavesService } from './leaves.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AdjustBalanceDto,
  CreateLeavePolicyDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  DecideLeaveRequestDto,
  LeaveBalanceQueryDto,
  LeaveRequestQueryDto,
  LeaveTransactionQueryDto,
  LeaveTypeQueryDto,
  UpdateLeaveTypeDto,
} from './dto/leaves.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('leaves')
@Controller('leaves')
export class LeavesController {
  constructor(private readonly service: LeavesService) {}

  // =========================================================================
  // انواع و سیاست‌ها
  // =========================================================================

  @Get('types')
  @RequirePermissions(PERMISSIONS.LEAVES_VIEW)
  @ApiOperation({ summary: 'فهرست انواع مرخصی' })
  listTypes(@Query() query: LeaveTypeQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listTypes(query, pagination, user);
  }
  @Post('types')
  @RequirePermissions(PERMISSIONS.LEAVES_MANAGE_TYPES)
  @ApiOperation({ summary: 'ایجاد نوع مرخصی' })
  createType(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createType(dto, user);
  }
  @Patch('types/:id')
  @RequirePermissions(PERMISSIONS.LEAVES_MANAGE_TYPES)
  @ApiOperation({ summary: 'ویرایش نوع مرخصی' })
  updateType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeaveTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateType(id, dto, user);
  }
  @Post('policies')
  @RequirePermissions(PERMISSIONS.LEAVES_MANAGE_TYPES)
  @ApiOperation({ summary: 'ثبت/به‌روزرسانی سیاست مرخصی' })
  upsertPolicy(@Body() dto: CreateLeavePolicyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.upsertPolicy(dto, user);
  }
  @Get('requests')
  @RequirePermissions(PERMISSIONS.LEAVES_VIEW)
  @ApiOperation({ summary: 'فهرست درخواست‌های مرخصی' })
  listRequests(
    @Query() query: LeaveRequestQueryDto,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listRequests(query, pagination, user);
  }
  @Post('requests')
  @RequirePermissions(PERMISSIONS.LEAVES_CREATE)
  @ApiOperation({ summary: 'ثبت و ارسال درخواست مرخصی' })
  createRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createRequest(dto, user);
  }
  @Post('requests/:id/decide')
  @RequirePermissions(PERMISSIONS.LEAVES_APPROVE)
  @ApiOperation({ summary: 'تصمیم روی درخواست (تأیید/رد/نیاز به اصلاح)' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decide(id, dto, user);
  }
  @Delete('requests/:id')
  @RequirePermissions(PERMISSIONS.LEAVES_VIEW)
  @ApiOperation({ summary: 'لغو درخواست مرخصی' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancel(id, user);
  }
  @Get('balance')
  @RequirePermissions(PERMISSIONS.LEAVES_VIEW)
  @ApiOperation({ summary: 'مانده مرخصی نیرو به تفکیک نوع' })
  balance(@Query() query: LeaveBalanceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.balance(query, user);
  }
  @Get('transactions')
  @RequirePermissions(PERMISSIONS.LEAVES_VIEW)
  @ApiOperation({ summary: 'فهرست تراکنش‌های مانده' })
  listTransactions(
    @Query() query: LeaveTransactionQueryDto,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listTransactions(query, pagination, user);
  }
  @Post('transactions')
  @RequirePermissions(PERMISSIONS.LEAVES_MANAGE_TYPES)
  @ApiOperation({ summary: 'ثبت تراکنش دستی مانده (واگذاری/اصلاح/انقضا)' })
  adjustBalance(@Body() dto: AdjustBalanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.adjustBalance(dto, user);
  }
  @Get('types/:id/policies')
  @RequirePermissions(PERMISSIONS.LEAVES_VIEW)
  @ApiOperation({ summary: 'سیاست‌های نوع مرخصی' })
  listPolicies(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listPolicies(id, user);
  }
  @Get('requests/:id')
  @RequirePermissions(PERMISSIONS.LEAVES_VIEW)
  @ApiOperation({ summary: 'جزئیات درخواست با تاریخچه' })
  getRequest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getRequest(id, user);
  }
}
