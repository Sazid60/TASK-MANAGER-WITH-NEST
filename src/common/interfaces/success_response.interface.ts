export interface SuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: unknown;
  timestamp: string;
}