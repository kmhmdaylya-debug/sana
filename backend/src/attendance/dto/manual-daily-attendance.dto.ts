import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ManualDailyAttendanceDto {
  @ApiProperty({ enum: ['PRESENT', 'ABSENT'] })
  @IsIn(['PRESENT', 'ABSENT'])
  status: 'PRESENT' | 'ABSENT';

  @ApiProperty({ example: '2026-11-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day: string;

  @ApiPropertyOptional({ example: '08:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  firstIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
