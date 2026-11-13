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
import { ContractsService } from './contracts.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateContractDto,
  CreateContractVersionDto,
  ContractQueryDto,
  UpdateContractDto,
} from './dto/contracts.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CONTRACTS_VIEW)
  @ApiOperation({ summary: 'فهرست قراردادها' })
  list(@Query() query: ContractQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }
  @Get('expiring')
  @RequirePermissions(PERMISSIONS.CONTRACTS_VIEW)
  @ApiOperation({ summary: 'قراردادهای در حال انقضا (۳۰ روز آینده)' })
  expiring(@CurrentUser() user: AuthenticatedUser) {
    return this.service.expiring(30, user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.CONTRACTS_CREATE)
  @ApiOperation({ summary: 'ایجاد قرارداد جدید' })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }
  @Post(':id/versions')
  @RequirePermissions(PERMISSIONS.CONTRACTS_CREATE)
  @ApiOperation({ summary: 'ایجاد نسخه جدید قرارداد (تمدید/تغییر شرایط)' })
  addVersion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateContractVersionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addVersion(id, dto, user);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CONTRACTS_UPDATE)
  @ApiOperation({ summary: 'تغییر وضعیت قرارداد' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.setStatus(id, dto, user);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CONTRACTS_UPDATE)
  @ApiOperation({ summary: 'حذف منطقی قرارداد' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.CONTRACTS_VIEW)
  @ApiOperation({ summary: 'جزئیات قرارداد با همه نسخه‌ها' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
