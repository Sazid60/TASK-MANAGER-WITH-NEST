
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResult } from '../interfaces/paginated-result.interface';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function buildPaginationParams(dto: PaginationDto): PaginationParams {
  const page = Math.max(1, dto.page || 1);
  const limit = Math.min(100, Math.max(1, dto.limit || 10));
  const skip = (page - 1) * limit;
  const sortBy = dto.sortBy || 'createdAt';
  const sortOrder = (dto.sortOrder || 'desc') as 'asc' | 'desc';

  return { page, limit, skip, sortBy, sortOrder };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit);

  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1,
    },
  };
}