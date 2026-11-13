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
import { ProjectsService } from './projects.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  CreateProjectDto,
  CreateProjectTaskDto,
  ProjectQueryDto,
  TimelineQueryDto,
  UpdateProjectDto,
  UpdateProjectTaskDto,
} from './dto/projects.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECTS_VIEW)
  @ApiOperation({ summary: 'فهرست پروژه‌ها' })
  list(@Query() query: ProjectQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }

  @Get('timeline')
  @RequirePermissions(PERMISSIONS.PROJECTS_VIEW)
  @ApiOperation({ summary: 'دادهٔ تقویم پروژه و گانت چارت' })
  timeline(@Query() query: TimelineQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.timeline(query, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECTS_CREATE)
  @ApiOperation({ summary: 'ایجاد پروژه' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Post(':id/tasks')
  @RequirePermissions(PERMISSIONS.PROJECTS_UPDATE)
  @ApiOperation({ summary: 'افزودن کار به پروژه (بخش گانت چارت)' })
  addTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProjectTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addTask(id, dto, user);
  }

  @Patch('tasks/:taskId')
  @RequirePermissions(PERMISSIONS.PROJECTS_UPDATE)
  @ApiOperation({ summary: 'ویرایش کار پروژه' })
  updateTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateProjectTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateTask(taskId, dto, user);
  }

  @Delete('tasks/:taskId')
  @RequirePermissions(PERMISSIONS.PROJECTS_UPDATE)
  @ApiOperation({ summary: 'حذف کار پروژه' })
  removeTask(@Param('taskId', ParseUUIDPipe) taskId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeTask(taskId, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_UPDATE)
  @ApiOperation({ summary: 'ویرایش پروژه' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_DELETE)
  @ApiOperation({ summary: 'حذف پروژه' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_VIEW)
  @ApiOperation({ summary: 'جزئیات پروژه' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
