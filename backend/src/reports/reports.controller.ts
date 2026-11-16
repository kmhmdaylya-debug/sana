import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Body,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ReportRunQueryDto, RunReportDto } from './dto/reports.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('definitions')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'فهرست گزارش‌های قابل اجرا' })
  listDefinitions(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listDefinitions(user);
  }

  @Get('runs')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'تاریخچه اجرای گزارش‌ها' })
  listRuns(@Query() query: ReportRunQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listRuns(query, pagination, user);
  }

  @Post('run')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiOperation({ summary: 'اجرای گزارش و دریافت فایل CSV/XLSX' })
  async run(@Body() dto: RunReportDto, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const result = await this.service.run(dto, user);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}.${dto.format === 'xlsx' ? 'xlsx' : 'csv'}"`,
    );
    return res.send(result.buffer);
  }
}
