import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DateRangeDto } from '../../../common/dto/date-range.dto';
import { IntersectionType } from '@nestjs/mapped-types';

export class QueryUserDto extends IntersectionType(PaginationDto, DateRangeDto) {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string; // Inherited from PaginationDto; documented again for clarity
}