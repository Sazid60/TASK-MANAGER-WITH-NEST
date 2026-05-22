export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: {
    code?: string;
    details?: unknown;
    path?: string;
    timestamp: string;
  };
}