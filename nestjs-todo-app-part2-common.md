# NestJS Todo App — Part 2: Common Layer
## Guards · Filters · Interceptors · Decorators · Pipes · Utils

---

## 1. Enums (`src/common/enums/roles.enum.ts`)

```typescript
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum Permission {
  // User permissions
  READ_OWN_TASKS = 'READ_OWN_TASKS',
  CREATE_TASK = 'CREATE_TASK',
  UPDATE_OWN_TASK = 'UPDATE_OWN_TASK',
  DELETE_OWN_TASK = 'DELETE_OWN_TASK',
  READ_OWN_PROFILE = 'READ_OWN_PROFILE',
  UPDATE_OWN_PROFILE = 'UPDATE_OWN_PROFILE',

  // Admin permissions
  READ_ALL_TASKS = 'READ_ALL_TASKS',
  READ_ALL_USERS = 'READ_ALL_USERS',
  UPDATE_ANY_USER = 'UPDATE_ANY_USER',
  DELETE_ANY_USER = 'DELETE_ANY_USER',
  SUSPEND_USER = 'SUSPEND_USER',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.READ_OWN_TASKS,
    Permission.CREATE_TASK,
    Permission.UPDATE_OWN_TASK,
    Permission.DELETE_OWN_TASK,
    Permission.READ_OWN_PROFILE,
    Permission.UPDATE_OWN_PROFILE,
  ],
  [Role.ADMIN]: Object.values(Permission), // Admin has all permissions
};
```

---

## 2. Decorators

### `src/common/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return data ? user?.[data] : user;
  },
);
```

### `src/common/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/roles.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### `src/common/decorators/permissions.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/roles.enum';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

### `src/common/decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### `src/common/decorators/api-paginated-response.decorator.ts`

```typescript
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

export const ApiPaginatedResponse = <TModel extends Type<any>>(model: TModel) =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
```

---

## 3. Interfaces (`src/common/interfaces/`)

### `jwt-payload.interface.ts`

```typescript
import { Role } from '../enums/roles.enum';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}
```

### `paginated-result.interface.ts`

```typescript
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

---

## 4. DTOs

### `src/common/dto/pagination.dto.ts`

```typescript
import { IsOptional, IsPositive, IsString, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;
}
```

### `src/common/dto/date-range.dto.ts`

```typescript
import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeDto {
  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
```

### `src/common/dto/paginated-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty() hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty() success: boolean;
  @ApiProperty() statusCode: number;
  @ApiProperty() message: string;
  data: T[];
  @ApiProperty({ type: PaginationMeta }) meta: PaginationMeta;
}
```

---

## 5. Filters — Global Exception Filter

### `src/common/filters/global-exception.filter.ts`

```typescript
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
        return {
          statusCode: status,
          message: (Array.isArray(res.message)
            ? res.message.join(', ')
            : res.message as string) || exception.message,
          details: Array.isArray(res.message) ? res.message : undefined,
        };
      }

      return { statusCode: status, message: exception.message };
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
```

---

## 6. Interceptors — Centralized Response

### `src/common/interceptors/response.interceptor.ts`

```typescript
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
        // Controllers can return { message, data, meta } objects
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
```

---

## 7. Guards

### `src/common/guards/jwt-auth.guard.ts`

```typescript
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const message =
        info?.name === 'TokenExpiredError'
          ? 'Access token has expired'
          : info?.message || 'Unauthorized';
      throw err || new UnauthorizedException(message);
    }
    return user;
  }
}
```

### `src/common/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user) throw new ForbiddenException('No user found in request');

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

### `src/common/guards/permissions.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, ROLE_PERMISSIONS, Role } from '../enums/roles.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user) throw new ForbiddenException('No user found in request');

    const userPermissions = ROLE_PERMISSIONS[user.role as Role] || [];
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
```

---

## 8. Utils

### `src/common/utils/pagination.util.ts`

```typescript
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
```

### `src/common/utils/date-range.util.ts`

```typescript
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
```

### `src/common/utils/hash.util.ts`

```typescript
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}
```

---

## 9. Validation Pipe (`src/common/pipes/validation.pipe.ts`)

```typescript
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,          // strip unknown fields
      forbidNonWhitelisted: true, // throw on unknown fields
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((err) =>
        Object.values(err.constraints || {}),
      );
      throw new BadRequestException({
        message: messages,
        error: 'Validation Failed',
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
```

---

## 10. Throttler (Windowed Rate Limiting) Setup

NestJS `@nestjs/throttler` implements a **sliding window / fixed window** rate limiter.

### Custom throttler guard (`src/common/guards/throttler.guard.ts`)

```typescript
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    throw new ThrottlerException(
      `Rate limit exceeded. Try again in ${Math.ceil(
        throttlerLimitDetail.timeToExpire / 1000,
      )} seconds.`,
    );
  }

  // Use IP + user ID as key when authenticated
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.sub;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return userId ? `${userId}:${ip}` : ip;
  }
}
```
