import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DateRangeDto } from '../../../common/dto/date-range.dto';
import { IntersectionType } from '@nestjs/mapped-types';

export class QueryTaskDto extends IntersectionType(PaginationDto, DateRangeDto) {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter by user ID (admin only)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}