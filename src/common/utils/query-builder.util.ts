// A dynamic, reusable Prisma query builder for filtering, searching, sorting, and pagination
// Usage: buildDynamicQuery({ filters, search, searchFields, sort, pagination })

export interface DynamicQueryBuilderOptions {
  query: Record<string, any>;
  filterableFields: string[];
  searchableFields: string[];
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
}

export function buildDynamicQuery({
  query,
  filterableFields,
  searchableFields,
  defaultSortBy = 'createdAt',
  defaultSortOrder = 'desc',
}: DynamicQueryBuilderOptions) {
  const filters: any = {};
  filterableFields.forEach(field => {
    if (query[field] !== undefined) filters[field] = query[field];
  });

  const where: any = { ...filters };

  if (query.search && searchableFields.length > 0) {
    where.OR = searchableFields.map(field => ({
      [field]: { contains: String(query.search), mode: 'insensitive' }
    }));
  }

  const sortBy = query.sortBy && searchableFields.concat(filterableFields).includes(query.sortBy)
    ? query.sortBy
    : defaultSortBy;
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : defaultSortOrder;

  return {
    where,
    orderBy: { [sortBy]: sortOrder },
    skip: query.skip ? Number(query.skip) : 0,
    take: query.limit ? Number(query.limit) : 10,
  };
}

// Utility to pick only allowed fields from an object
export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Partial<T> {
  const finalObject: Partial<T> = {};
  for (const key of keys) {
    if (obj && Object.hasOwnProperty.call(obj, key)) {
      finalObject[key] = obj[key];
    }
  }
  return finalObject;
}
