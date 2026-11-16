import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TaskPriority, TaskStatus, WorkCategory } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateTaskDto {
  @ApiPropertyOptional({ enum: WorkCategory })
  @IsOptional()
  @IsEnum(WorkCategory)
  category?: WorkCategory | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  companyId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiProperty()
  @IsString({ message: 'عنوان task الزامی است.' })
  @MaxLength(240)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString({})
  dueDate?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  slaHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  projectName?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'نیروهای مسئول' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'کاربران مسئول (کاربر = نیرو)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeUserIds?: string[];
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: WorkCategory })
  @IsOptional()
  @IsEnum(WorkCategory)
  category?: WorkCategory | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({})
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  slaHours?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  delayReason?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'کاربران مسئول (کاربر = نیرو)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeUserIds?: string[];
}

export class TaskQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: WorkCategory })
  @IsOptional()
  @IsEnum(WorkCategory)
  category?: WorkCategory;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  orgUnitId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  createdById?: string;

  @ApiPropertyOptional({ enum: ['overdue', 'due-soon'] })
  @IsOptional()
  @IsString()
  filter?: string;
}

export class TaskCommentDto {
  @ApiProperty()
  @IsString({ message: 'متن دیدگاه الزامی است.' })
  content: string;
}

export class TaskDependencyDto {
  @ApiProperty({ format: 'uuid', description: 'task پیش‌نیاز' })
  @IsUUID('4')
  dependsOnTaskId: string;
}

export class ReviewTaskRetryDto {
  @ApiProperty()
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
