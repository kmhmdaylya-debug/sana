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
import { LoansService } from './loans.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AssignBenefitDto,
  BenefitTypeQueryDto,
  CreateBenefitPackageDto,
  CreateBenefitTypeDto,
  CreateLoanDto,
  DecideLoanDto,
  DisburseLoanDto,
  EmployeeBenefitQueryDto,
  LoanQueryDto,
  PayInstallmentDto,
  UpdateBenefitStatusDto,
  UpdateBenefitTypeDto,
} from './dto/loans.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('loans')
@Controller('loans')
export class LoansController {
  constructor(private readonly service: LoansService) {}

  // =========================================================================
  // وام
  // =========================================================================

  @Get()
  @RequirePermissions(PERMISSIONS.LOANS_VIEW)
  @ApiOperation({ summary: 'فهرست وام‌ها و مساعده‌ها' })
  listLoans(@Query() query: LoanQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listLoans(query, pagination, user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.LOANS_CREATE)
  @ApiOperation({ summary: 'ثبت درخواست وام با اقساط خودکار' })
  createLoan(@Body() dto: CreateLoanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createLoan(dto, user);
  }
  @Post(':id/decide')
  @RequirePermissions(PERMISSIONS.LOANS_APPROVE)
  @ApiOperation({ summary: 'تأیید/رد وام (هیچ‌کس وام خودش را تأیید نمی‌کند)' })
  decideLoan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLoanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.decideLoan(id, dto, user);
  }
  @Post(':id/disburse')
  @RequirePermissions(PERMISSIONS.LOANS_APPROVE)
  @ApiOperation({ summary: 'ثبت پرداخت وام' })
  disburseLoan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DisburseLoanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.disburseLoan(id, dto, user);
  }
  @Post('installments/:installmentId/pay')
  @RequirePermissions(PERMISSIONS.LOANS_CREATE)
  @ApiOperation({ summary: 'ثبت کسر قسط در دوره حقوق' })
  payInstallment(
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
    @Body() dto: PayInstallmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.payInstallment(installmentId, dto, user);
  }
  @Get('benefit-types')
  @RequirePermissions(PERMISSIONS.LOANS_VIEW)
  @ApiOperation({ summary: 'فهرست انواع مزایا' })
  listBenefitTypes(@Query() query: BenefitTypeQueryDto, @Query() pagination: PaginationDto) {
    return this.service.listBenefitTypes(query, pagination);
  }
  @Post('benefit-types')
  @RequirePermissions(PERMISSIONS.LOANS_APPROVE)
  @ApiOperation({ summary: 'تعریف نوع مزایا' })
  createBenefitType(@Body() dto: CreateBenefitTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBenefitType(dto, user);
  }
  @Patch('benefit-types/:id')
  @RequirePermissions(PERMISSIONS.LOANS_APPROVE)
  @ApiOperation({ summary: 'ویرایش نوع مزایا' })
  updateBenefitType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBenefitTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateBenefitType(id, dto, user);
  }
  @Get('packages')
  @RequirePermissions(PERMISSIONS.LOANS_VIEW)
  @ApiOperation({ summary: 'فهرست بسته‌های مزایا' })
  listPackages(@Query() pagination: PaginationDto, @Query('companyId') companyId?: string) {
    return this.service.listPackages(pagination, companyId);
  }
  @Post('packages')
  @RequirePermissions(PERMISSIONS.LOANS_APPROVE)
  @ApiOperation({ summary: 'تعریف بسته مزایا' })
  createPackage(@Body() dto: CreateBenefitPackageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createPackage(dto, user);
  }
  @Get('employee-benefits')
  @RequirePermissions(PERMISSIONS.LOANS_VIEW)
  @ApiOperation({ summary: 'فهرست مزایای نیروها' })
  listEmployeeBenefits(@Query() query: EmployeeBenefitQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listEmployeeBenefits(query, pagination, user);
  }
  @Post('employee-benefits')
  @RequirePermissions(PERMISSIONS.LOANS_CREATE)
  @ApiOperation({ summary: 'واگذاری مزایا (نوع مستقیم یا بسته)' })
  assignBenefit(@Body() dto: AssignBenefitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.assignBenefit(dto, user);
  }
  @Patch('employee-benefits/:id')
  @RequirePermissions(PERMISSIONS.LOANS_CREATE)
  @ApiOperation({ summary: 'تغییر وضعیت مزایای نیرو' })
  updateBenefitStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBenefitStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateBenefitStatus(id, dto, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.LOANS_VIEW)
  @ApiOperation({ summary: 'جزئیات وام با اقساط' })
  getLoan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getLoan(id, user);
  }
}
