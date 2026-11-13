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
import { TasksService } from './tasks.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateTaskDto, TaskCommentDto, TaskDependencyDto, TaskQueryDto, UpdateTaskDto } from './dto/tasks.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TASKS_VIEW)
  @ApiOperation({ summary: 'فهرست وظایف' })
  list(@Query() query: TaskQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.TASKS_CREATE)
  @ApiOperation({ summary: 'ایجاد وظیفه' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASKS_UPDATE)
  @ApiOperation({ summary: 'ویرایش وظیفه (وضعیت/پیشرفت/مسئولان)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TASKS_DELETE)
  @ApiOperation({ summary: 'حذف وظیفه' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
  @Post(':id/comments')
  @RequirePermissions(PERMISSIONS.TASKS_VIEW)
  @ApiOperation({ summary: 'ثبت دیدگاه' })
  addComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TaskCommentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addComment(id, dto, user);
  }
  @Post(':id/dependencies')
  @RequirePermissions(PERMISSIONS.TASKS_UPDATE)
  @ApiOperation({ summary: 'افزودن وابستگی' })
  addDependency(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TaskDependencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.addDependency(id, dto, user);
  }
  @Delete('dependencies/:dependencyId')
  @RequirePermissions(PERMISSIONS.TASKS_UPDATE)
  @ApiOperation({ summary: 'حذف وابستگی' })
  removeDependency(@Param('dependencyId', ParseUUIDPipe) dependencyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.removeDependency(dependencyId, user);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.TASKS_VIEW)
  @ApiOperation({ summary: 'جزئیات وظیفه' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
