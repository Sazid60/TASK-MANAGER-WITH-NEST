import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: unknown;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();
    const statusCode: number = response.statusCode;

    return next.handle().pipe(
      map((result) => {
        const isStructured =
          result && typeof result === 'object' && ('data' in result || 'message' in result);

        return {
          success: true,
          statusCode,
          message: isStructured ? result.message || 'Success' : 'Success',
          data: isStructured ? (result.data ?? null) : result ?? null,
          meta: isStructured ? result.meta : undefined,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
