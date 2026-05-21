# NestJS Task Manager: Complete Step-by-Step Production Guide

This guide contains the complete, production-ready codebase, setup commands, and explanation for building a highly scalable NestJS application. It is organized into 5 parts:
- **Part 1**: Setup, Folder Structure, Prisma Schema, Configuration, and Infrastructure Services
- **Part 2**: Common Shared Layer (Guards, Filters, Interceptors, Decorators, Pipes, and Utilities)
- **Part 3**: Authentication and Security Module
- **Part 4**: Users & Tasks Modules (CRUD, Pagination, Filters)
- **Part 5**: Root Application Wiring, Seeding, and Running

---

# Part 1: Setup, Configuration & Infrastructure Services

## 1. Installation & Bootstrap

```bash
# 1. Install NestJS CLI globally
npm i -g @nestjs/cli

# 2. Create project
nest new todo-app
cd todo-app

# 3. Core dependencies
npm install \
  @nestjs/config \
  @nestjs/jwt \
  @nestjs/passport \
  @nestjs/throttler \
  @nestjs/cache-manager \
  @nestjs/swagger \
  passport \
  passport-jwt \
  passport-local \
  @prisma/client \
  prisma \
  redis \
  ioredis \
  cache-manager-ioredis-yet \
  bcryptjs \
  nodemailer \
  class-validator \
  class-transformer \
  http-status-codes \
  uuid \
  dayjs

# 4. Dev dependencies
npm install -D \
  @types/passport-jwt \
  @types/passport-local \
  @types/bcryptjs \
  @types/nodemailer \
  @types/uuid \
  prisma

# 5. Init Prisma
npx prisma init
```

---

## 2. Folder Structure

```
src/
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── dto/
│   │   └── pagination.dto.ts
│   ├── enums/
│   │   └── roles.enum.ts
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── permissions.guard.ts
│   ├── interceptors/
│   │   └── response.interceptor.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── utils/
│       ├── pagination.util.ts
│       └── date-range.util.ts
├── config/
│   ├── app.config.ts
│   ├── jwt.config.ts
│   ├── redis.config.ts
│   └── mail.config.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       ├── login.dto.ts
│   │       ├── verify-otp.dto.ts
│   │       └── refresh-token.dto.ts
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   │       ├── update-user.dto.ts
│   │       └── query-user.dto.ts
│   └── tasks/
│       ├── tasks.controller.ts
│       ├── tasks.service.ts
│       ├── tasks.module.ts
│       └── dto/
│           ├── create-task.dto.ts
│           ├── update-task.dto.ts
│           └── query-task.dto.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── mail/
│   ├── mail.module.ts
│   ├── mail.service.ts
│   └── templates/
│       └── otp.template.ts
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts
├── seed/
│   └── seed.ts
├── app.module.ts
└── main.ts
```

---

## 3. Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
}

model User {
  id            String     @id @default(uuid())
  email         String     @unique
  password      String
  name          String
  role          Role       @default(USER)
  status        UserStatus @default(ACTIVE)
  isVerified    Boolean    @default(false)
  tasks         Task[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@map("users")
}

model Task {
  id          String       @id @default(uuid())
  title       String
  description String?
  status      TaskStatus   @default(PENDING)
  priority    TaskPriority @default(MEDIUM)
  dueDate     DateTime?
  completedAt DateTime?
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([userId])
  @@index([status])
  @@index([priority])
  @@index([dueDate])
  @@map("tasks")
}
```

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## 4. Environment Variables (`.env`)

```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/todo_db?schema=public"

# JWT
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_here_min_32_chars
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Mail (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="Todo App <your@gmail.com>"

# Admin Seed
ADMIN_EMAIL=admin@todo.com
ADMIN_PASSWORD=Admin@123456

# OTP
OTP_EXPIRES_MINUTES=5
```

---

## 5. Config Files

### `src/config/app.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
}));
```

### `src/config/jwt.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));
```

### `src/config/redis.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));
```

### `src/config/mail.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM,
  otpExpireMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES || '5', 10),
}));
```

---

## 6. Prisma Service (`src/prisma/prisma.service.ts`)

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
```

### `src/prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Makes PrismaService available everywhere without re-importing
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## 7. Redis Service (`src/redis/redis.service.ts`)

```typescript
import { Injectable, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  onModuleDestroy() {
    this.client.quit();
  }
}
```

### `src/redis/redis.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

---

## 8. Mail Service (`src/mail/mail.service.ts`)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: true,
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.pass'),
      },
    });
  }

  async sendOtp(email: string, otp: string, name: string): Promise<void> {
    const from = this.configService.get<string>('mail.from');
    const expireMin = this.configService.get<number>('mail.otpExpireMinutes');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; 
                  border: 1px solid #e2e8f0; border-radius: 8px; padding: 32px;">
        <h2 style="color: #1a202c;">Hello, ${name}!</h2>
        <p style="color: #4a5568;">Your One-Time Password (OTP) for login is:</p>
        <div style="background: #edf2f7; border-radius: 6px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2d3748;">
            ${otp}
          </span>
        </div>
        <p style="color: #718096; font-size: 14px;">
          This OTP is valid for <strong>${expireMin} minutes</strong>. Do not share it with anyone.
        </p>
        <p style="color: #a0aec0; font-size: 12px; margin-top: 24px;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Your Login OTP — Todo App',
        html,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${email}`, error);
      throw new Error('Failed to send OTP email');
    }
  }
}
```

### `src/mail/mail.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

---

## 9. Seeder (`src/seed/seed.ts`)

```typescript
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  const existing = await prisma.user.findFirst({ where: { role: Role.ADMIN } });

  if (existing) {
    console.log('✅ Super Admin already exists, skipping seed.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.ADMIN,
      isVerified: true,
      status: 'ACTIVE',
    },
  });

  console.log('🌱 Super Admin seeded:', admin.email);
}

seedAdmin()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Add to `package.json`:
```json
{
  "scripts": {
    "seed": "ts-node src/seed/seed.ts"
  }
}
```


---

# Part 2: Common Shared Layer

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


---

# Part 3: Authentication & Security Module

## 1. Auth DTOs

### `src/modules/auth/dto/register.dto.ts`

```typescript
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'StrongPass@123',
    description:
      'Min 8 chars, must have uppercase, lowercase, number, and special character',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/, {
    message:
      'Password must contain uppercase, lowercase, number, and special character',
  })
  password: string;
}
```

### `src/modules/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'StrongPass@123' })
  @IsString()
  @MinLength(6)
  password: string;
}
```

### `src/modules/auth/dto/verify-otp.dto.ts`

```typescript
import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
```

### `src/modules/auth/dto/refresh-token.dto.ts`

```typescript
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

---

## 2. JWT Strategy (`src/modules/auth/strategies/jwt.strategy.ts`)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Validate user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    return { sub: user.id, email: user.email, role: user.role as any };
  }
}
```

---

## 3. Auth Service (`src/modules/auth/auth.service.ts`)

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { comparePassword, generateOtp, hashPassword } from '../../common/utils/hash.util';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { Role } from '../../common/enums/roles.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Redis key namespaces
  private readonly OTP_PREFIX = 'otp:';
  private readonly OTP_ATTEMPTS_PREFIX = 'otp_attempts:';
  private readonly REFRESH_PREFIX = 'refresh:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── REGISTER ────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (exists) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: Role.USER,
        isVerified: false,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    // Send OTP for email verification on first login
    this.logger.log(`New user registered: ${user.email}`);

    return {
      message: 'Registration successful. Please login with your credentials.',
      data: user,
    };
  }

  // ─── LOGIN (step 1: validate credentials → send OTP) ─────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'DELETED') {
      throw new UnauthorizedException('This account has been deleted');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account is suspended. Contact support.');
    }

    const isPasswordValid = await comparePassword(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate and store OTP in Redis
    const otp = generateOtp(6);
    const otpKey = `${this.OTP_PREFIX}${user.email}`;
    const attemptsKey = `${this.OTP_ATTEMPTS_PREFIX}${user.email}`;
    const expireMinutes = this.config.get<number>('mail.otpExpireMinutes', 5);

    await this.redis.set(otpKey, otp, expireMinutes * 60);
    await this.redis.set(attemptsKey, '0', expireMinutes * 60);

    // Send OTP via email
    await this.mail.sendOtp(user.email, otp, user.name);

    return {
      message: `OTP sent to ${user.email}. Valid for ${expireMinutes} minutes.`,
      data: { email: user.email },
    };
  }

  // ─── VERIFY OTP (step 2: validate OTP → issue JWT) ──────────────────────────

  async verifyOtp(dto: VerifyOtpDto) {
    const otpKey = `${this.OTP_PREFIX}${dto.email}`;
    const attemptsKey = `${this.OTP_ATTEMPTS_PREFIX}${dto.email}`;

    const storedOtp = await this.redis.get(otpKey);

    if (!storedOtp) {
      throw new BadRequestException('OTP has expired or was never sent. Please login again.');
    }

    // Max 5 wrong attempts
    const attemptsStr = await this.redis.get(attemptsKey);
    const attempts = parseInt(attemptsStr || '0', 10);

    if (attempts >= 5) {
      await this.redis.del(otpKey);
      await this.redis.del(attemptsKey);
      throw new BadRequestException('Too many failed OTP attempts. Please login again.');
    }

    if (storedOtp !== dto.otp) {
      await this.redis.set(attemptsKey, String(attempts + 1), 300);
      throw new BadRequestException(
        `Invalid OTP. ${4 - attempts} attempt(s) remaining.`,
      );
    }

    // OTP valid → clean up Redis
    await this.redis.del(otpKey);
    await this.redis.del(attemptsKey);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) throw new NotFoundException('User not found');

    // Mark as verified if first login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role as Role);

    return {
      message: 'Login successful',
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        ...tokens,
      },
    };
  }

  // ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if refresh token is blacklisted / rotated
    const storedToken = await this.redis.get(`${this.REFRESH_PREFIX}${payload.sub}`);

    if (storedToken && storedToken !== refreshToken) {
      // Token reuse detected → invalidate all tokens (security measure)
      await this.redis.del(`${this.REFRESH_PREFIX}${payload.sub}`);
      throw new UnauthorizedException('Refresh token reuse detected. Please login again.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role as Role);

    return {
      message: 'Tokens refreshed successfully',
      data: tokens,
    };
  }

  // ─── LOGOUT ───────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    await this.redis.del(`${this.REFRESH_PREFIX}${userId}`);
    return { message: 'Logged out successfully', data: null };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    // Store refresh token in Redis for rotation validation
    const expireSeconds = 7 * 24 * 60 * 60; // 7 days
    await this.redis.set(`${this.REFRESH_PREFIX}${userId}`, refreshToken, expireSeconds);

    return { accessToken, refreshToken };
  }
}
```

---

## 4. Auth Controller (`src/modules/auth/auth.controller.ts`)

```typescript
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/register
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/v1/auth/login
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute (windowed)
  @ApiOperation({ summary: 'Login with credentials (sends OTP)' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // POST /api/v1/auth/verify-otp
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify OTP and receive JWT tokens' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // POST /api/v1/auth/refresh
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  // POST /api/v1/auth/logout
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.sub);
  }
}
```

---

## 5. Auth Module (`src/modules/auth/auth.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Configured dynamically in service via JwtService.signAsync options
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```


---

# Part 4: Users & Tasks Modules

## ══════════════════ USERS MODULE ══════════════════

## 1. User DTOs

### `src/modules/users/dto/query-user.dto.ts`

```typescript
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DateRangeDto } from '../../../common/dto/date-range.dto';
import { IntersectionType } from '@nestjs/mapped-types';

export class QueryUserDto extends IntersectionType(PaginationDto, DateRangeDto) {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string; // Inherited from PaginationDto; documented again for clarity
}
```

### `src/modules/users/dto/update-user.dto.ts`

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;
}

// Admin-only update DTO
export class AdminUpdateUserDto extends UpdateUserDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
```

---

## 2. Users Service (`src/modules/users/users.service.ts`)

```typescript
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryUserDto } from './dto/query-user.dto';
import { AdminUpdateUserDto, UpdateUserDto } from './dto/update-user.dto';
import { buildPaginationParams, buildPaginatedResult } from '../../common/utils/pagination.util';
import { buildDateRangeFilter } from '../../common/utils/date-range.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── ADMIN: GET ALL USERS ──────────────────────────────────────────────────

  async findAll(query: QueryUserDto) {
    const params = buildPaginationParams(query);
    const dateFilter = buildDateRangeFilter('createdAt', query);

    // Build where clause
    const where: Prisma.UserWhereInput = {
      role: 'USER', // Admins only see user accounts (not other admins)
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...dateFilter,
    };

    // Validate sortBy field against allowed columns
    const allowedSortFields = ['name', 'email', 'createdAt', 'status'];
    const sortBy = allowedSortFields.includes(params.sortBy) ? params.sortBy : 'createdAt';

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { tasks: true } },
        },
        skip: params.skip,
        take: params.limit,
        orderBy: { [sortBy]: params.sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(users, total, params);
  }

  // ─── GET ONE USER ──────────────────────────────────────────────────────────

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { tasks: true } },
      },
    });

    if (!user) throw new NotFoundException(`User with ID "${id}" not found`);

    return user;
  }

  // ─── USER: UPDATE OWN PROFILE ──────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateUserDto) {
    await this.findOne(userId); // Ensure exists

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: {
        id: true, name: true, email: true, role: true,
        status: true, updatedAt: true,
      },
    });

    return { message: 'Profile updated successfully', data: updated };
  }

  // ─── ADMIN: UPDATE ANY USER ────────────────────────────────────────────────

  async adminUpdateUser(id: string, dto: AdminUpdateUserDto) {
    await this.findOne(id); // Ensure exists

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.status && { status: dto.status }),
      },
      select: {
        id: true, name: true, email: true, role: true,
        status: true, updatedAt: true,
      },
    });

    return { message: 'User updated successfully', data: updated };
  }

  // ─── ADMIN: SOFT DELETE (MARK AS DELETED) ─────────────────────────────────

  async deleteUser(id: string) {
    const user = await this.findOne(id);

    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Cannot delete admin accounts');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    return { message: 'User deleted successfully', data: null };
  }

  // ─── ADMIN: SUSPEND / ACTIVATE ────────────────────────────────────────────

  async suspendUser(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
    return { message: 'User suspended', data: null };
  }

  async activateUser(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    return { message: 'User activated', data: null };
  }
}
```

---

## 3. Users Controller (`src/modules/users/users.controller.ts`)

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { QueryUserDto } from './dto/query-user.dto';
import { AdminUpdateUserDto, UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Permission } from '../../common/enums/roles.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── USER: Own Profile ─────────────────────────────────────────────────────

  // GET /api/v1/users/me
  @Get('me')
  @RequirePermissions(Permission.READ_OWN_PROFILE)
  @ApiOperation({ summary: 'Get own profile' })
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(user.sub);
  }

  // PATCH /api/v1/users/me
  @Patch('me')
  @RequirePermissions(Permission.UPDATE_OWN_PROFILE)
  @ApiOperation({ summary: 'Update own profile' })
  async updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // ─── ADMIN: User Management ────────────────────────────────────────────────

  // GET /api/v1/users  (admin only)
  @Get()
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.READ_ALL_USERS)
  @ApiOperation({ summary: '[Admin] List all users with pagination, search, filter' })
  async findAll(@Query() query: QueryUserDto) {
    const result = await this.usersService.findAll(query);
    return {
      message: 'Users retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  // GET /api/v1/users/:id  (admin only)
  @Get(':id')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.READ_ALL_USERS)
  @ApiOperation({ summary: '[Admin] Get user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // PATCH /api/v1/users/:id  (admin only)
  @Patch(':id')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.UPDATE_ANY_USER)
  @ApiOperation({ summary: '[Admin] Update user name or status' })
  async adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.usersService.adminUpdateUser(id, dto);
  }

  // PATCH /api/v1/users/:id/suspend  (admin only)
  @Patch(':id/suspend')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.SUSPEND_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Suspend user' })
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.suspendUser(id);
  }

  // PATCH /api/v1/users/:id/activate  (admin only)
  @Patch(':id/activate')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.UPDATE_ANY_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Activate user' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activateUser(id);
  }

  // DELETE /api/v1/users/:id  (admin only — soft delete)
  @Delete(':id')
  @Roles(Role.ADMIN)
  @RequirePermissions(Permission.DELETE_ANY_USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Soft-delete user' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deleteUser(id);
  }
}
```

### `src/modules/users/users.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## ══════════════════ TASKS MODULE ══════════════════

## 4. Task DTOs

### `src/modules/tasks/dto/create-task.dto.ts`

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Complete NestJS project' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Build full-stack todo app' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
```

### `src/modules/tasks/dto/update-task.dto.ts`

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
```

### `src/modules/tasks/dto/query-task.dto.ts`

```typescript
import { IsOptional, IsEnum, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DateRangeDto } from '../../../common/dto/date-range.dto';
import { IntersectionType } from '@nestjs/mapped-types';

export class QueryTaskDto extends IntersectionType(PaginationDto, DateRangeDto) {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter by user ID (admin only)' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
```

---

## 5. Tasks Service (`src/modules/tasks/tasks.service.ts`)

```typescript
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { buildPaginationParams, buildPaginatedResult } from '../../common/utils/pagination.util';
import { buildDateRangeFilter } from '../../common/utils/date-range.util';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/roles.enum';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE TASK ──────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority || 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        userId,
      },
    });

    return { message: 'Task created successfully', data: task };
  }

  // ─── GET ALL TASKS (with filters) ─────────────────────────────────────────

  async findAll(
    requestingUserId: string,
    requestingUserRole: string,
    query: QueryTaskDto,
  ) {
    const params = buildPaginationParams(query);
    const dateFilter = buildDateRangeFilter('createdAt', query);
    const dueDateFilter = buildDateRangeFilter('dueDate', {
      startDate: query.startDate,
      endDate: query.endDate,
    });

    // Role-based ownership scoping
    const ownerFilter =
      requestingUserRole === Role.ADMIN
        ? query.userId
          ? { userId: query.userId }
          : {}
        : { userId: requestingUserId };

    const where: Prisma.TaskWhereInput = {
      ...ownerFilter,
      ...(query.status && { status: query.status }),
      ...(query.priority && { priority: query.priority }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...dateFilter,
    };

    const allowedSortFields = ['title', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt'];
    const sortBy = allowedSortFields.includes(params.sortBy) ? params.sortBy : 'createdAt';

    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        skip: params.skip,
        take: params.limit,
        orderBy: { [sortBy]: params.sortOrder },
      }),
      this.prisma.task.count({ where }),
    ]);

    return buildPaginatedResult(tasks, total, params);
  }

  // ─── GET ONE TASK ──────────────────────────────────────────────────────────

  async findOne(
    taskId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) throw new NotFoundException(`Task with ID "${taskId}" not found`);

    this.assertOwnerOrAdmin(task.userId, requestingUserId, requestingUserRole);

    return task;
  }

  // ─── UPDATE TASK ──────────────────────────────────────────────────────────

  async update(
    taskId: string,
    requestingUserId: string,
    requestingUserRole: string,
    dto: UpdateTaskDto,
  ) {
    const task = await this.findOne(taskId, requestingUserId, requestingUserRole);

    const updateData: Prisma.TaskUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
      ...(dto.status !== undefined && {
        status: dto.status,
        completedAt:
          dto.status === 'COMPLETED'
            ? new Date()
            : dto.status === 'PENDING' || dto.status === 'IN_PROGRESS'
            ? null
            : undefined,
      }),
    };

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    return { message: 'Task updated successfully', data: updated };
  }

  // ─── MARK AS COMPLETED (convenience endpoint) ─────────────────────────────

  async markCompleted(
    taskId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    return this.update(taskId, requestingUserId, requestingUserRole, {
      status: 'COMPLETED',
    });
  }

  // ─── DELETE TASK ──────────────────────────────────────────────────────────

  async remove(
    taskId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    await this.findOne(taskId, requestingUserId, requestingUserRole);

    await this.prisma.task.delete({ where: { id: taskId } });

    return { message: 'Task deleted successfully', data: null };
  }

  // ─── TASK STATS (for user dashboard) ──────────────────────────────────────

  async getStats(userId: string, requestingUserRole: string) {
    const scopedUserId = requestingUserRole === Role.ADMIN ? undefined : userId;

    const [total, pending, inProgress, completed] = await Promise.all([
      this.prisma.task.count({ where: { userId: scopedUserId } }),
      this.prisma.task.count({ where: { userId: scopedUserId, status: 'PENDING' } }),
      this.prisma.task.count({ where: { userId: scopedUserId, status: 'IN_PROGRESS' } }),
      this.prisma.task.count({ where: { userId: scopedUserId, status: 'COMPLETED' } }),
    ]);

    return {
      message: 'Task statistics retrieved',
      data: { total, pending, inProgress, completed },
    };
  }

  // ─── HELPER ───────────────────────────────────────────────────────────────

  private assertOwnerOrAdmin(
    ownerId: string,
    requestingUserId: string,
    role: string,
  ): void {
    if (role !== Role.ADMIN && ownerId !== requestingUserId) {
      throw new ForbiddenException('You do not have access to this task');
    }
  }
}
```

---

## 6. Tasks Controller (`src/modules/tasks/tasks.controller.ts`)

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/roles.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // POST /api/v1/tasks
  @Post()
  @RequirePermissions(Permission.CREATE_TASK)
  @ApiOperation({ summary: 'Create a new task' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user.sub, dto);
  }

  // GET /api/v1/tasks
  // Users see only their tasks; Admin can see all or filter by userId
  @Get()
  @RequirePermissions(Permission.READ_OWN_TASKS)
  @ApiOperation({
    summary: 'List tasks. Users see own; Admin sees all. Supports pagination, search, filter, sort, date range.',
  })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryTaskDto,
  ) {
    const result = await this.tasksService.findAll(user.sub, user.role, query);
    return {
      message: 'Tasks retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  // GET /api/v1/tasks/stats
  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics for the current user' })
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getStats(user.sub, user.role);
  }

  // GET /api/v1/tasks/:id
  @Get(':id')
  @RequirePermissions(Permission.READ_OWN_TASKS)
  @ApiOperation({ summary: 'Get a single task by ID' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.findOne(id, user.sub, user.role);
  }

  // PATCH /api/v1/tasks/:id
  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_OWN_TASK)
  @ApiOperation({ summary: 'Update a task' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.sub, user.role, dto);
  }

  // PATCH /api/v1/tasks/:id/complete
  @Patch(':id/complete')
  @RequirePermissions(Permission.UPDATE_OWN_TASK)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark task as completed' })
  async markCompleted(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.markCompleted(id, user.sub, user.role);
  }

  // DELETE /api/v1/tasks/:id
  @Delete(':id')
  @RequirePermissions(Permission.DELETE_OWN_TASK)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.remove(id, user.sub, user.role);
  }
}
```

### `src/modules/tasks/tasks.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```


---

# Part 5: Root Application Wiring, Seeding & Running

## 10. Root Application Setup & Wiring

### 1. Main App Module (`src/app.module.ts`)
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, APP_GUARD } from '@nestjs/throttler';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import mailConfig from './config/mail.config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, redisConfig, mailConfig],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    UsersModule,
    TasksModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### 2. Main Entry Point (`src/main.ts`)
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Todo App API')
    .setDescription('The Todo Application API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
```

---

## 11. Seeding & Running

### Admin Seeder Script (`src/seed/seed.ts`)
```typescript
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  const existing = await prisma.user.findFirst({ where: { role: Role.ADMIN } });

  if (existing) {
    console.log('✅ Super Admin already exists, skipping seed.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.ADMIN,
      isVerified: true,
      status: 'ACTIVE',
    },
  });

  console.log('🌱 Super Admin seeded:', admin.email);
}

seedAdmin()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Add the following to your `package.json` scripts:
```json
{
  "scripts": {
    "seed": "ts-node src/seed/seed.ts"
  }
}
```

To seed the database, run:
```bash
npm run seed
```

