import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrainingService } from './training.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateCertificateDto,
  CreateCourseDto,
  CreateTrainingRecordDto,
  CourseQueryDto,
  CertificateQueryDto,
  TrainingRecordQueryDto,
  UpdateCourseDto,
} from './dto/training.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('training')
@Controller('training')
export class TrainingController {
  constructor(private readonly service: TrainingService) {}

  // =========================================================================
  // دوره‌ها
  // =========================================================================

  @Get('courses')
  @RequirePermissions(PERMISSIONS.TRAINING_VIEW)
  @ApiOperation({ summary: 'فهرست دوره‌های آموزشی' })
  listCourses(@Query() query: CourseQueryDto, @Query() pagination: PaginationDto) {
    return this.service.listCourses(query, pagination);
  }
  @Post('courses')
  @RequirePermissions(PERMISSIONS.TRAINING_MANAGE)
  @ApiOperation({ summary: 'تعریف دوره آموزشی' })
  createCourse(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCourse(dto, user.id);
  }
  @Patch('courses/:id')
  @RequirePermissions(PERMISSIONS.TRAINING_MANAGE)
  @ApiOperation({ summary: 'ویرایش دوره آموزشی' })
  updateCourse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateCourse(id, dto, user.id);
  }
  @Put('courses/:id/prerequisites')
  @RequirePermissions(PERMISSIONS.TRAINING_MANAGE)
  @ApiOperation({ summary: 'تنظیم دوره‌های پیش‌نیاز' })
  setPrerequisites(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('prerequisiteIds') prerequisiteIds: string[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setPrerequisites(id, Array.isArray(prerequisiteIds) ? prerequisiteIds : [], user.id);
  }
  @Get('records')
  @RequirePermissions(PERMISSIONS.TRAINING_VIEW)
  @ApiOperation({ summary: 'فهرست سوابق آموزش' })
  listRecords(@Query() query: TrainingRecordQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listRecords(query, pagination, user);
  }
  @Post('records')
  @RequirePermissions(PERMISSIONS.TRAINING_MANAGE)
  @ApiOperation({ summary: 'ثبت سابقه آموزش (با بررسی پیش‌نیاز)' })
  createRecord(@Body() dto: CreateTrainingRecordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createRecord(dto, user);
  }
  @Get('certificates')
  @RequirePermissions(PERMISSIONS.TRAINING_VIEW)
  @ApiOperation({ summary: 'فهرست گواهینامه‌ها' })
  listCertificates(@Query() query: CertificateQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listCertificates(query, pagination, user);
  }
  @Get('certificates/expiring')
  @RequirePermissions(PERMISSIONS.TRAINING_VIEW)
  @ApiOperation({ summary: 'گواهینامه‌های در حال انقضا (۹۰ روز آینده)' })
  expiring(@CurrentUser() user: AuthenticatedUser) {
    return this.service.expiringCertificates(user);
  }
  @Post('certificates')
  @RequirePermissions(PERMISSIONS.TRAINING_MANAGE)
  @ApiOperation({ summary: 'ثبت گواهینامه' })
  createCertificate(@Body() dto: CreateCertificateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCertificate(dto, user);
  }
  @Delete('certificates/:id')
  @RequirePermissions(PERMISSIONS.TRAINING_MANAGE)
  @ApiOperation({ summary: 'حذف گواهینامه' })
  removeCertificate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeCertificate(id, user);
  }
  @Get('courses/:id')
  @RequirePermissions(PERMISSIONS.TRAINING_VIEW)
  @ApiOperation({ summary: 'جزئیات دوره با پیش‌نیازها' })
  getCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCourse(id);
  }
}
