import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import {
  CreateEvaluationCycleDto,
  CreateEvaluationFeedbackDto,
  CreateEvaluationFormDto,
  CreateGoalDto,
  EmployeeParamDto,
  EmployeeResponseDto,
  EvaluationCycleQueryDto,
  EvaluationFormQueryDto,
  EvaluationItemInputDto,
  EvaluationQueryDto,
  GoalQueryDto,
  SelfAssessDto,
  StartEvaluationCycleDto,
  SupervisorAssessDto,
  UpdateEvaluationCycleDto,
  UpdateEvaluationFormDto,
  UpdateEvaluationItemDto,
  UpdateGoalDto,
} from './dto/evaluations.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('evaluations')
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  // =========================================================================
  // فرم ارزیابی
  // =========================================================================

  @Get('forms')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'فهرست فرم‌های ارزیابی' })
  listForms(@Query() query: EvaluationFormQueryDto) {
    return this.service.listForms(query);
  }
  @Post('forms')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'ایجاد فرم ارزیابی' })
  createForm(@Body() dto: CreateEvaluationFormDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createForm(dto, user.id);
  }
  @Patch('forms/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'ویرایش فرم ارزیابی' })
  updateForm(@Param('id') id: string, @Body() dto: UpdateEvaluationFormDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateForm(id, dto, user.id);
  }
  @Delete('forms/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'غیرفعال‌سازی فرم ارزیابی' })
  deleteForm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteForm(id, user.id);
  }
  @Put('forms/:id/items')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'جایگزینی کامل سنجه‌های فرم' })
  replaceItems(
    @Param('id') formId: string,
    @Body() body: { items: EvaluationItemInputDto[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.replaceItems(formId, body?.items ?? [], user.id);
  }
  @Post('forms/:id/items')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'افزودن سنجه به فرم' })
  createItem(
    @Param('id') formId: string,
    @Body() dto: EvaluationItemInputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createItem(formId, dto, user.id);
  }
  @Patch('items/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'ویرایش سنجه' })
  updateItem(@Param('id') id: string, @Body() dto: UpdateEvaluationItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateItem(id, dto, user.id);
  }
  @Delete('items/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'حذف سنجه' })
  deleteItem(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteItem(id, user.id);
  }
  @Get('cycles')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'فهرست دوره‌های ارزیابی' })
  listCycles(@Query() query: EvaluationCycleQueryDto) {
    return this.service.listCycles(query);
  }
  @Post('cycles')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'ایجاد دوره ارزیابی' })
  createCycle(@Body() dto: CreateEvaluationCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCycle(dto, user.id);
  }
  @Patch('cycles/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'ویرایش دوره ارزیابی' })
  updateCycle(@Param('id') id: string, @Body() dto: UpdateEvaluationCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateCycle(id, dto, user.id);
  }
  @Delete('cycles/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'لغو دوره ارزیابی' })
  deleteCycle(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteCycle(id, user.id);
  }
  @Post('cycles/:id/start')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'اجرای دوره و ساخت رکوردهای ارزیابی' })
  startCycle(@Param('id') id: string, @Body() dto: StartEvaluationCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.startCycle(id, dto, user);
  }
  @Get()
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'فهرست رکوردهای ارزیابی با فیلتر و محدوده دسترسی' })
  list(@Query() query: EvaluationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, user);
  }
  @Post(':id/self-assess')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'ارزیابی خودی کارمند' })
  selfAssess(@Param('id') id: string, @Body() dto: SelfAssessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.selfAssess(id, dto, user);
  }
  @Post(':id/supervisor-assess')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_RATE)
  @ApiOperation({ summary: 'ارزیابی سرپرست' })
  supervisorAssess(@Param('id') id: string, @Body() dto: SupervisorAssessDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.supervisorAssess(id, dto, user);
  }
  @Post(':id/feedback')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'ثبت بازخورد روی ارزیابی' })
  addFeedback(@Param('id') id: string, @Body() dto: CreateEvaluationFeedbackDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addFeedback(id, dto, user);
  }
  @Post(':id/employee-response')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'بازخورد کارمند به نتیجه ارزیابی' })
  employeeResponse(@Param('id') id: string, @Body() dto: EmployeeResponseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.employeeResponse(id, dto, user);
  }
  @Post(':id/finalize')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_APPROVE)
  @ApiOperation({ summary: 'نهایی‌سازی و قفل نتیجه ارزیابی' })
  finalize(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.finalize(id, user);
  }
  @Get('goals')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'فهرست اهداف عملکردی' })
  listGoals(@Query() query: GoalQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listGoals(query, user);
  }
  @Post('goals')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'ایجاد هدف' })
  createGoal(@Body() dto: CreateGoalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createGoal(dto, user);
  }
  @Patch('goals/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'ویرایش هدف و پیشرفت' })
  updateGoal(@Param('id') id: string, @Body() dto: UpdateGoalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateGoal(id, dto, user);
  }
  @Delete('goals/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_MANAGE)
  @ApiOperation({ summary: 'حذف هدف' })
  deleteGoal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteGoal(id, user);
  }
  @Get('forms/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'جزئیات فرم ارزیابی با سنجه‌ها' })
  getForm(@Param('id') id: string) {
    return this.service.getForm(id);
  }
  @Get('forms/:id/items')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'سنجه‌های فرم ارزیابی' })
  listItems(@Param('id') formId: string) {
    return this.service.listItems(formId);
  }
  @Get('cycles/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'جزئیات دوره ارزیابی' })
  getCycle(@Param('id') id: string) {
    return this.service.getCycle(id);
  }
  @Get('cycles/:id/calibration')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'نمای کالیبراسیون نمرات دوره' })
  calibration(@Param('id') cycleId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.calibration(cycleId, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'جزئیات رکورد ارزیابی' })
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
  @Get('trend/:employeeId')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'روند نمرات ارزیابی نیرو در دوره‌ها' })
  trend(@Param() params: EmployeeParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.trend(params.employeeId, user);
  }
  @Get('goals/:id')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'جزئیات هدف' })
  getGoal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getGoal(id, user);
  }
  @Get('goals/progress/:employeeId')
  @RequirePermissions(PERMISSIONS.EVALUATIONS_VIEW)
  @ApiOperation({ summary: 'خلاصه پیشرفت اهداف نیرو' })
  goalProgress(@Param() params: EmployeeParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.goalProgress(params.employeeId, user);
  }
}
