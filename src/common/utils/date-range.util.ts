import { DateRangeDto } from '../dto/date-range.dto';

export function buildDateRangeFilter(
  field: string,
  dateRange?: DateRangeDto,
): Record<string, unknown> {
  if (!dateRange?.startDate && !dateRange?.endDate) return {};

  const filter: Record<string, Date> = {};

  if (dateRange.startDate) {
    filter.gte = new Date(dateRange.startDate);
  }
  if (dateRange.endDate) {
    // Include full end day
    const end = new Date(dateRange.endDate);
    end.setHours(23, 59, 59, 999);
    filter.lte = end;
  }

  return { [field]: filter };
}