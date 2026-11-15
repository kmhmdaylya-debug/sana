import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PanelTaskResultDto {
  @ApiProperty({ enum: ['START', 'DONE', 'UNABLE'] })
  @IsIn(['START', 'DONE', 'UNABLE'])
  result: 'START' | 'DONE' | 'UNABLE';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CheckInDto {
  @ApiPropertyOptional({ example: '2026-11-20', description: 'تاریخ ثبت (پیش‌فرض: امروز)' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ معتبر نیست.' })
  workDate?: string;

  @ApiPropertyOptional({ example: 480, description: 'مدت کارکرد به دقیقه' })
  @IsOptional()
  @IsInt({ message: 'مدت باید عدد صحیح باشد.' })
  @Min(0, { message: 'مدت نمی‌تواند منفی باشد.' })
  @Max(1440, { message: 'مدت بیش از یک روز نمی‌تواند باشد.' })
  minutes?: number;

  @ApiPropertyOptional({ example: 'پیاده‌سازی گزارش ماهانه انجام شد.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PanelLeaveRequestDto {
  @ApiProperty({ format: 'uuid', description: 'نوع مرخصی' })
  @IsUUID('4', { message: 'شناسهٔ نوع مرخصی معتبر نیست.' })
  leaveTypeId: string;

  @ApiProperty({ example: '2026-11-20T08:00:00.000Z' })
  @IsDateString({}, { message: 'قالب شروع مرخصی نامعتبر است.' })
  startAt: string;

  @ApiProperty({ example: '2026-11-21T16:00:00.000Z' })
  @IsDateString({}, { message: 'قالب پایان مرخصی نامعتبر است.' })
  endAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PanelMissionExpenseDto {
  @ApiProperty({ example: 'هزینهٔ ایاب و ذهاب' })
  @IsString({ message: 'شرح هزینه الزامی است.' })
  @MaxLength(300)
  description: string;

  @ApiProperty({ example: 1200000 })
  @IsInt({ message: 'مبلغ باید عدد صحیح باشد.' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد.' })
  amount: number;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsDateString({}, { message: 'قالب تاریخ معتبر نیست.' })
  spentAt?: string;
}
