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
import { ShiftsService } from './shifts.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AssignmentQueryDto,
  BulkAssignDto,
  CreateShiftDto,
  CreateSwapDto,
  DecideSwapDto,
  ShiftQueryDto,
  SwapQueryDto,
  UpdateShiftDto,
} from './dto/shifts.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SHIFTS_VIEW)
  @ApiOperation({ summary: 'فهرست شیفت‌ها' })
  list(@Query() query: ShiftQueryDto, @Query() pagination: PaginationDto) {
    return this.service.list(query, pagination);
  }
  @Get('swaps')
  @RequirePermissions(PERMISSIONS.SHIFTS_VIEW)
  @ApiOperation({ summary: 'فهرست درخواست‌های تعویض شیفت' })
  listSwaps(@Query() query: SwapQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listSwaps(query, pagination, user);
  }
  @Get('plan')
  @RequirePermissions(PERMISSIONS.SHIFTS_VIEW)
  @ApiOperation({ summary: 'برنامه کاری هفتگی/ماهانه' })
  plan(@Query() query: AssignmentQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.plan(query, user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.SHIFTS_MANAGE)
  @ApiOperation({ summary: 'تعریف شیفت' })
  create(@Body() dto: CreateShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SHIFTS_MANAGE)
  @ApiOperation({ summary: 'ویرایش شیفت' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user.id);
  }
  @Post('assignments/bulk')
  @RequirePermissions(PERMISSIONS.SHIFTS_MANAGE)
  @ApiOperation({ summary: 'تخصیص گروهی شیفت' })
  bulkAssign(@Body() dto: BulkAssignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.bulkAssign(dto, user);
  }
  @Delete('assignments/:assignmentId')
  @RequirePermissions(PERMISSIONS.SHIFTS_MANAGE)
  @ApiOperation({ summary: 'حذف تخصیص شیفت' })
  removeAssignment(@Param('assignmentId', ParseUUIDPipe) assignmentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeAssignment(assignmentId, user);
  }
  @Post('swaps')
  @RequirePermissions(PERMISSIONS.SHIFTS_SWAP)
  @ApiOperation({ summary: 'ثبت درخواست تعویض/تحویل شیفت' })
  createSwap(@Body() dto: CreateSwapDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createSwap(dto, user);
  }
  @Post('swaps/:id/decide')
  @RequirePermissions(PERMISSIONS.SHIFTS_APPROVE)
  @ApiOperation({ summary: 'بررسی درخواست تعویض (تأیید/رد)' })
  decideSwap(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideSwapDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decideSwap(id, dto, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.SHIFTS_VIEW)
  @ApiOperation({ summary: 'جزئیات شیفت' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }
}
