import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNextPage!: boolean;
  @ApiProperty() hasPreviousPage!: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty() success!: boolean;
  @ApiProperty() statusCode!: number;
  @ApiProperty() message!: string;
  data!: T[];
  @ApiProperty({ type: PaginationMeta }) meta!: PaginationMeta;
}