import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
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

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, code, details } = this.resolveException(exception);

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode,
      message,
      error: {
        code,
        details,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.error(
      `[${request.method}] ${request.url} → ${statusCode}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(statusCode).json(errorResponse);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string;
    code?: string;
    details?: unknown;
  } {
    // NestJS HTTP Exception
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        let message = (Array.isArray(res.message)
            ? res.message.join(', ')
            : res.message as string) || exception.message;
            
        if (status === 404 && message.startsWith('Cannot ')) {
          message = 'Api not found';
        }

        return {
          statusCode: status,
          message,
          details: Array.isArray(res.message) ? res.message : undefined,
        };
      }

      let message = exception.message;
      if (status === 404 && message.startsWith('Cannot ')) {
        message = 'Api not found';
      }
      return { statusCode: status, message };
    }

    // Prisma Known Errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception);
    }

    // Prisma Validation Error
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Database validation error',
        code: 'PRISMA_VALIDATION',
        details: exception.message,
      };
    }

    // Prisma Init Error
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      };
    }

    // JWT errors
    if (exception instanceof Error) {
      if (exception.name === 'JsonWebTokenError') {
        return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Invalid token', code: 'INVALID_TOKEN' };
      }
      if (exception.name === 'TokenExpiredError') {
        return { statusCode: HttpStatus.UNAUTHORIZED, message: 'Token expired', code: 'TOKEN_EXPIRED' };
      }
    }

    // Fallback
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    };
  }

  private handlePrismaError(err: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    code: string;
    details?: unknown;
  } {
    switch (err.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `Duplicate value for field: ${(err.meta?.target as string[])?.join(', ')}`,
          code: 'DUPLICATE_ENTRY',
          details: err.meta,
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          code: 'NOT_FOUND',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record not found (foreign key constraint)',
          code: 'FOREIGN_KEY_VIOLATION',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Relation violation',
          code: 'RELATION_VIOLATION',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: `Database error: ${err.code}`,
          code: err.code,
          details: err.meta,
        };
    }
  }
}