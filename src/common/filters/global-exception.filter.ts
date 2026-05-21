import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private configService: ConfigService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong!';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse() as any;
      message = typeof res === 'object' ? res.message || exception.message : res;
      errorDetails = res;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';

    response.status(statusCode).json({
      success: false,
      message,
      error: {
        statusCode,
        message,
        details: errorDetails,
        stack: nodeEnv === 'development' ? exception.stack : undefined,
      },
    });
  }
}
