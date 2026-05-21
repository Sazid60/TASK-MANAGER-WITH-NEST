# NestJS Task Manager: Complete Step-by-Step Implementation Guide

This document contains the complete codebase, setup commands, and explanation for building a production-ready **NestJS** application integrated with **Prisma v7**, **PostgreSQL**, **Redis**, **Nodemailer (EJS)**, and **Rate Limiting**. It is designed as a learning resource to demonstrate the full capabilities and architecture of NestJS.

---

## 1. Architectural Overview & Request Lifecycle

NestJS uses a modular architecture where components are grouped into logical, reusable building blocks (**Modules**). Within each module, files are organized into **Controllers** (handling incoming requests and routes), **Services** (containing business logic), and **DTOs** (Data Transfer Objects for validation).

### Request Lifecycle
The request flows through several layers, each serving a specific security, validation, or processing purpose:

```
Request (from Client)
  │
  ├──► 1. Middleware (Rate limiting, Body parser, Cookie parser, Request logger)
  │
  ├──► 2. Guards (Auth Check: Is the user logged in? Do they have the required Role?)
  │
  ├──► 3. Interceptors (Before Controller logic starts: timing/logging)
  │
  ├──► 4. Pipes (ValidationPipe: Validate DTOs, parse/trim input fields)
  │
  ├──► 5. Controller (Route mapping, parameter parsing)
  │
  ├──► 6. Service (Database queries, external APIs, business rules)
  │
  ├──► 7. Controller return value
  │
  ├──► 8. Interceptors (After Controller logic finishes: formats standard responses)
  │
  ├──► 9. Exception Filters (Runs only if an error is thrown: formats standard error responses)
  │
  ▼
Response (back to Client)
```

---

## 2. Directory & Highly Scalable Folder Structure

To ensure the codebase remains clean, maintainable, and scalable, we organize our files using the following pattern:

```
task-manager/
├── prisma/
│   └── schema.prisma          # Database models (Prisma v7 schema)
├── src/
│   ├── main.ts                # Application entrypoint
│   ├── app.module.ts          # Main application module
│   ├── config/                # Configuration management
│   │   ├── config.module.ts
│   │   └── config.service.ts
│   ├── common/                # Shared decorators, guards, filters, interceptors
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── user.decorator.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts
│   │   ├── middlewares/
│   │   │   └── rate-limit.middleware.ts
│   │   └── pipes/
│   │       └── trim.pipe.ts
│   ├── helpers/               # Utility functions
│   │   ├── cookies.helper.ts
│   │   ├── jwt.helper.ts
│   │   ├── pagination.helper.ts
│   │   ├── pick.ts
│   │   └── token.ts
│   ├── prisma/                # Prisma ORM module
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── redis/                 # Redis cache/store module (OTP)
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   ├── mail/                  # Nodemailer & EJS template module
│   │   ├── templates/
│   │   │   └── otp.ejs
│   │   ├── mail.module.ts
│   │   └── mail.service.ts
│   └── modules/               # Feature modules
│       ├── auth/              # Registration, Login, OTP verification
│       │   ├── dto/
│       │   │   ├── login.dto.ts
│       │   │   ├── register.dto.ts
│       │   │   └── verify-otp.dto.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── auth.module.ts
│       │   └── seedAdmin.ts   # Automatically seeds Super Admin
│       ├── user/              # User management (Admin only)
│       │   ├── dto/
│       │   │   └── update-user-status.dto.ts
│       │   ├── user.controller.ts
│       │   ├── user.service.ts
│       │   └── user.module.ts
│       └── task/              # Tasks CRUD & Filtering (User own tasks)
│           ├── dto/
│           │   ├── create-task.dto.ts
│           │   ├── query-task.dto.ts
│           │   └── update-task.dto.ts
│           ├── task.controller.ts
│           ├── task.service.ts
│           └── task.module.ts
└── test/                      # Testing files
    ├── jest-e2e.json
    ├── auth.e2e-spec.ts       # Authentication E2E tests
    └── task.service.spec.ts   # Task Service unit tests
```

---

## 3. Step-by-Step Installation & Env Configuration

### Step 1: Install Dependencies
Run the following commands in your terminal to install the correct packages:

```bash
# 1. Install regular dependencies
npm install @nestjs/config ioredis nodemailer ejs bcryptjs jsonwebtoken class-validator class-transformer express-rate-limit cookie-parser http-status @prisma/client@7

# 2. Install dev dependencies
npm install -D prisma@7 @types/nodemailer @types/ejs @types/bcryptjs @types/jsonwebtoken @types/cookie-parser @types/express @nestjs/testing ts-jest jest
```

### Step 2: Set Up Environment Variables
Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/taskdb?schema=public"
FRONTEND_URL="http://localhost:3000"

# Redis Config
REDIS_URL="redis://localhost:6379"

# Email Sender Config (Nodemailer)
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_FROM="your-email@gmail.com"

# JWT configuration
JWT_SECRET="super-secret-access-key-12345"
EXPIRES_IN="15m"
REFRESH_TOKEN_SECRET="super-secret-refresh-key-67890"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Security configuration
SALT_ROUND=12
ADMIN_EMAIL="admin@taskmanager.com"
ADMIN_PASSWORD="SuperSecretAdminPassword123!"
```

---

## 4. Prisma v7 Configuration

Create a folder named `prisma` in the root of your project, and create a file inside named `schema.prisma`.

### `prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
  PENDING
}

enum TaskStatus {
  PENDING
  COMPLETED
}

model User {
  id                 String     @id @default(uuid())
  email              String     @unique
  password           String
  role               UserRole
  status             UserStatus @default(ACTIVE)
  needPasswordChange Boolean    @default(false)
  tasks              Task[]
  admin              Admin?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
}

model Admin {
  id            String   @id @default(uuid())
  name          String
  profilePhoto  String?
  contactNumber String?
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId        String   @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Task {
  id          String     @id @default(uuid())
  title       String
  description String?
  status      TaskStatus @default(PENDING)
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```

### Prisma Commands
To apply the schema to your PostgreSQL database and generate the Prisma client, run:

```bash
# 1. Run migrations to update PostgreSQL
npx prisma migrate dev --name init

# 2. Re-generate Prisma Client
npx prisma generate
```

---

## 5. Core Infrastructure Modules

### Prisma Module & Service
Create `src/prisma/prisma.service.ts` and `src/prisma/prisma.module.ts`.

#### `src/prisma/prisma.service.ts`
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

#### `src/prisma/prisma.module.ts`
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

### Redis Module & Service
Uses `ioredis` to manage connection to local Redis server, cache OTPs, and perform authentication lookup.

#### `src/redis/redis.service.ts`
```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl);
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (expirySeconds) {
      await this.redisClient.set(key, value, 'EX', expirySeconds);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }
}
```

#### `src/redis/redis.module.ts`
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

### Mail Module & Service (Nodemailer + EJS templates)
Create `src/mail/mail.service.ts`, `src/mail/mail.module.ts` and EJS template.

#### `src/mail/templates/otp.ejs`
Create a folder `src/mail/templates` and place `otp.ejs` inside it:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7fafc; padding: 20px; color: #2d3748; }
    .container { max-width: 600px; background-color: #ffffff; padding: 40px; border-radius: 12px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { font-size: 20px; font-weight: bold; color: #1a202c; border-bottom: 1px solid #edf2f7; padding-bottom: 20px; margin-bottom: 20px; }
    .otp-code { font-size: 32px; font-weight: 800; color: #3182ce; text-align: center; letter-spacing: 4px; padding: 15px; background-color: #ebf8ff; border-radius: 8px; margin: 25px 0; }
    .footer { font-size: 12px; color: #a0aec0; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Task Manager Login Verification</div>
    <p>Hello,</p>
    <p>You requested a login code to access your Task Manager account. Please use the following One-Time Password (OTP) to complete your login:</p>
    <div class="otp-code"><%= otp %></div>
    <p>This OTP is valid for <strong>5 minutes</strong>. If you did not request this login, please ignore this email or contact support.</p>
    <div class="footer">
      This is an automated security message. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
```

#### `src/mail/mail.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as ejs from 'ejs';
import * as path from 'path';

interface SendMailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, any>;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT')),
      secure: true,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendEmail({ to, subject, templateName, templateData }: SendMailOptions): Promise<void> {
    try {
      const templatePath = path.join(process.cwd(), 'src/mail/templates', `${templateName}.ejs`);
      const html = await ejs.renderFile(templatePath, templateData);

      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to,
        subject,
        html,
      });
    } catch (error: any) {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }
}
```

#### `src/mail/mail.module.ts`
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

## 6. Helpers & Utilities

### `src/helpers/token.ts`
```typescript
export const convertExpiresInToMs = (expiresIn: string, defaultMs: number): number => {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1));
  switch (unit) {
    case "y":
      return value * 365 * 24 * 60 * 60 * 1000;
    case "M":
      return value * 30 * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
    default:
      return defaultMs;
  }
};
```

### `src/helpers/jwt.helper.ts`
```typescript
import * as jwt from 'jsonwebtoken';
import { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

const generateToken = (payload: JwtPayload, secret: Secret, expiresIn: string): string => {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn
  } as SignOptions);
};

const verifyToken = (token: string, secret: Secret): JwtPayload => {
  return jwt.verify(token, secret) as JwtPayload;
};

export const jwtHelper = {
  generateToken,
  verifyToken
};
```

### `src/helpers/pagination.helper.ts`
```typescript
export type IOptions = {
  page?: number;
  limit?: number;
  sortOrder?: string;
  sortBy?: string;
};

export type IOptionsResult = {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

const calculatePagination = (options: IOptions): IOptionsResult => {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const skip = (page - 1) * limit;

  const sortBy = options.sortBy || 'createdAt';
  const sortOrder = (options.sortOrder === 'asc' ? 'asc' : 'desc');

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder
  };
};

export const paginationHelper = {
  calculatePagination
};
```

### `src/helpers/cookies.helper.ts`
```typescript
import { Response } from 'express';

interface AuthToken {
  accessToken?: string;
  refreshToken?: string;
  accessTokenMaxAge?: number;
  refreshTokenMaxAge?: number;
}

export const setAuthCookie = (res: Response, tokenInfo: AuthToken) => {
  if (tokenInfo.accessToken) {
    res.cookie('accessToken', tokenInfo.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenInfo.accessTokenMaxAge || 1000 * 60 * 15, // 15 mins default
    });
  }
  if (tokenInfo.refreshToken) {
    res.cookie('refreshToken', tokenInfo.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenInfo.refreshTokenMaxAge || 1000 * 60 * 60 * 24 * 7, // 7 days default
    });
  }
};
```

### `src/helpers/pick.ts`
```typescript
const pick = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Partial<T> => {
  const finalObject: Partial<T> = {};

  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      finalObject[key] = obj[key];
    }
  }

  return finalObject;
};

export default pick;
```

---

## 7. Global Pipes, Guards, Interceptors, Exception Filters

### Global Exception Filter
Handles formatting standard error messages for Prisma database exceptions, NestJS HTTP Exceptions, and validation errors.

#### `src/common/filters/global-exception.filter.ts`
```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
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
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      errorDetails = { code: exception.code, meta: exception.meta };
      switch (exception.code) {
        case 'P2002':
          message = 'Unique constraint failed (duplicate key value)';
          statusCode = HttpStatus.CONFLICT;
          break;
        case 'P2003':
          message = 'Foreign key constraint failed';
          statusCode = HttpStatus.BAD_REQUEST;
          break;
        case 'P2025':
          message = 'Record to update or delete not found';
          statusCode = HttpStatus.NOT_FOUND;
          break;
        default:
          message = `Database query error: ${exception.message}`;
          statusCode = HttpStatus.BAD_REQUEST;
          break;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(statusCode).json({
      success: false,
      message,
      error: {
        statusCode,
        message,
        details: errorDetails,
        stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      },
    });
  }
}
```

---

### Global Response Interceptor
Formats all successful responses globally.

#### `src/common/interceptors/response.interceptor.ts`
```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseFormat<T> {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: any;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseFormat<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((result) => {
        // If results contain paginated attributes structured directly, extract them
        const message = result?.message || 'Operation successful';
        const data = result?.data !== undefined ? result.data : result;
        const meta = result?.meta ?? undefined;

        return {
          statusCode,
          success: true,
          message,
          meta,
          data,
        };
      }),
    );
  }
}
```

---

### Custom Guards & Decorators

#### `src/common/decorators/roles.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

#### `src/common/decorators/user.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  return data ? user?.[data] : user;
});
```

#### `src/common/guards/auth.guard.ts`
```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtHelper } from '../../helpers/jwt.helper';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check cookies first, then authorization headers
    let token = request.cookies?.['accessToken'];
    
    if (!token && request.headers.authorization) {
      const parts = request.headers.authorization.split(' ');
      if (parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const decoded = jwtHelper.verifyToken(token, secret);
      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
```

#### `src/common/guards/roles.guard.ts`
```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: Role authentication information not found');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('Access denied: You do not have permission to access this resource');
    }

    return true;
  }
}
```

---

### Custom Pipe & Rate Limiting Middleware

#### `src/common/pipes/trim.pipe.ts`
```typescript
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }
    
    if (typeof value === 'object' && value !== null) {
      Object.keys(value).forEach((key) => {
        if (typeof value[key] === 'string') {
          value[key] = value[key].trim();
        }
      });
    }
    return value;
  }
}
```

#### `src/common/middlewares/rate-limit.middleware.ts`
Uses `express-rate-limit` windowed rate limiting to shield routes.

```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: {
      statusCode: 429,
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // limit each IP to 10 login/verify attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    error: {
      statusCode: 429,
      message: 'Too many login attempts, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
```

---

## 8. AuthModule (Registration, OTP, Redis login, Seed Super Admin)

Create controllers, services, modules, and seeding logic inside `src/modules/auth`.

### DTOs

#### `src/modules/auth/dto/register.dto.ts`
```typescript
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
```

#### `src/modules/auth/dto/login.dto.ts`
```typescript
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
```

#### `src/modules/auth/dto/verify-otp.dto.ts`
```typescript
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
```

---

### Super Admin Seeder
Seers a Super Admin dynamically during project bootstrap.

#### `src/modules/auth/seedAdmin.ts`
```typescript
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeedSuperAdmin implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedSuperAdmin.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  async onApplicationBootstrap() {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
      const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
      const saltRound = Number(this.configService.get<string>('SALT_ROUND')) || 10;

      const adminExists = await this.prisma.user.findFirst({
        where: { role: UserRole.ADMIN },
      });

      if (adminExists) {
        this.logger.log('Super Admin already exists. Seeding skipped.');
        return;
      }

      const hashedPassword = await bcrypt.hash(adminPassword, saltRound);

      await this.prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          admin: {
            create: {
              name: 'Super Admin',
              profilePhoto: 'https://res.cloudinary.com/dosvjludu/image/upload/v1759681814/c1309i14mi8-1759681814423-sazid-webp.webp.webp',
              contactNumber: '+8801234567890',
            },
          },
        },
      });

      this.logger.log('Super Admin account created successfully.');
    } catch (err: any) {
      this.logger.error('Failed to seed Super Admin:', err.message);
    }
  }
}
```

---

### Auth Service
Manages authentication token generation, registration, password comparisons, Redis OTP validation, and Nodemailer dispatch.

#### `src/modules/auth/auth.service.ts`
```typescript
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserRole, UserStatus } from '@prisma/client';
import { jwtHelper } from '../../helpers/jwt.helper';
import { convertExpiresInToMs } from '../../helpers/token';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private mail: MailService,
    private configService: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (userExists) {
      throw new BadRequestException('User with this email already exists');
    }

    const saltRound = Number(this.configService.get<string>('SALT_ROUND')) || 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRound);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    return {
      message: 'Registration successful! Please login.',
      data: { id: user.id, email: user.email },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    if (user.status === UserStatus.DELETED || user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException(`Your account is currently ${user.status}`);
    }

    const isPassValid = await bcrypt.compare(dto.password, user.password);
    if (!isPassValid) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    // Generate random 6 digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store in Redis with 5 minutes TTL
    const redisKey = `otp:${dto.email}`;
    await this.redis.set(redisKey, otp, 300);

    // Send OTP using MailService with EJS templates
    await this.mail.sendEmail({
      to: dto.email,
      subject: 'Your OTP Login Code',
      templateName: 'otp',
      templateData: { otp, email: dto.email },
    });

    return {
      message: 'A 6-digit OTP code has been sent to your email. Please verify OTP to sign in.',
      data: { email: dto.email },
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const redisKey = `otp:${dto.email}`;
    const cachedOtp = await this.redis.get(redisKey);

    if (!cachedOtp || cachedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Remove OTP from Redis
    await this.redis.del(redisKey);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate Tokens
    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      message: 'OTP validation successful. Logged in successfully.',
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        accessToken,
        refreshToken,
      },
    };
  }

  async refreshTokens(token: string) {
    try {
      const refreshSecret = this.configService.get<string>('REFRESH_TOKEN_SECRET');
      const payload = jwtHelper.verifyToken(token, refreshSecret);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED) {
        throw new UnauthorizedException('User account has been suspended or deleted');
      }

      const { accessToken, refreshToken } = this.generateTokens(user);

      return {
        message: 'Tokens refreshed successfully.',
        data: { accessToken, refreshToken },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private generateTokens(user: any) {
    const payload = { userId: user.id, email: user.email, role: user.role };
    
    const accessToken = jwtHelper.generateToken(
      payload,
      this.configService.get<string>('JWT_SECRET'),
      this.configService.get<string>('EXPIRES_IN')
    );

    const refreshToken = jwtHelper.generateToken(
      payload,
      this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN')
    );

    return { accessToken, refreshToken };
  }
}
```

---

### Auth Controller & Auth Module

#### `src/modules/auth/auth.controller.ts`
```typescript
import { Body, Controller, Post, Req, Res, UnauthorizedException, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { TrimPipe } from '../../common/pipes/trim.pipe';
import { Response, Request } from 'express';
import { setAuthCookie } from '../../helpers/cookies.helper';
import { convertExpiresInToMs } from '../../helpers/token';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  @Post('register')
  @UsePipes(new TrimPipe())
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UsePipes(new TrimPipe())
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-otp')
  @UsePipes(new TrimPipe())
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyOtp(dto);

    const accessExpiry = this.configService.get<string>('EXPIRES_IN');
    const refreshExpiry = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN');

    setAuthCookie(res, {
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      accessTokenMaxAge: convertExpiresInToMs(accessExpiry, 1000 * 60 * 15),
      refreshTokenMaxAge: convertExpiresInToMs(refreshExpiry, 1000 * 60 * 60 * 24 * 7),
    });

    return {
      message: result.message,
      data: result.data.user,
    };
  }

  @Post('refresh-token')
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rToken = req.cookies?.['refreshToken'];
    if (!rToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const result = await this.authService.refreshTokens(rToken);

    const accessExpiry = this.configService.get<string>('EXPIRES_IN');
    const refreshExpiry = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN');

    setAuthCookie(res, {
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      accessTokenMaxAge: convertExpiresInToMs(accessExpiry, 1000 * 60 * 15),
      refreshTokenMaxAge: convertExpiresInToMs(refreshExpiry, 1000 * 60 * 60 * 24 * 7),
    });

    return {
      message: result.message,
    };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return {
      message: 'Logged out successfully.',
    };
  }
}
```

#### `src/modules/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SeedSuperAdmin } from './seedAdmin';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SeedSuperAdmin],
})
export class AuthModule {}
```

---

## 9. UserModule (Admin Operations)

Allows Super Admins to list all registered accounts, toggle status values, and delete accounts.

### DTO
#### `src/modules/user/dto/update-user-status.dto.ts`
```typescript
import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: 'Must be ACTIVE, SUSPENDED, DELETED, or PENDING' })
  @IsNotEmpty()
  status: UserStatus;
}
```

### Controller, Service & Module

#### `src/modules/user/user.service.ts`
```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        admin: {
          select: {
            name: true,
            contactNumber: true,
          },
        },
      },
    });
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot change the status of an Admin user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot delete an Admin account');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { id: userId };
  }
}
```

#### `src/modules/user/user.controller.ts`
```typescript
import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // Admin only routes
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async getAllUsers() {
    const users = await this.userService.getAllUsers();
    return {
      message: 'Users retrieved successfully',
      data: users,
    };
  }

  @Patch(':id/status')
  async updateUserStatus(@Param('id') userId: string, @Body() dto: UpdateUserStatusDto) {
    const updated = await this.userService.updateUserStatus(userId, dto.status);
    return {
      message: `User status updated to ${dto.status} successfully`,
      data: updated,
    };
  }

  @Delete(':id')
  async deleteUser(@Param('id') userId: string) {
    const result = await this.userService.deleteUser(userId);
    return {
      message: 'User deleted successfully',
      data: result,
    };
  }
}
```

#### `src/modules/user/user.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

---

## 10. TaskModule (User Task CRUD with Advanced Filters)

Allows authenticated users to manage their own tasks with pagination, searching, sorting, status filters, and date range filters.

### DTOs

#### `src/modules/task/dto/create-task.dto.ts`
```typescript
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Task title is required' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

#### `src/modules/task/dto/update-task.dto.ts`
```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus, { message: 'Must be PENDING or COMPLETED' })
  @IsOptional()
  status?: TaskStatus;
}
```

#### `src/modules/task/dto/query-task.dto.ts`
```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class QueryTaskDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  sortOrder?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  startDate?: string; // Date range filter: YYYY-MM-DD

  @IsOptional()
  endDate?: string;
}
```

---

### Controller, Service & Module

#### `src/modules/task/task.service.ts`
```typescript
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { paginationHelper } from '../../helpers/pagination.helper';
import { Prisma, TaskStatus } from '@prisma/client';

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  async createTask(userId: string, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        userId,
      },
    });
    return {
      message: 'Task created successfully',
      data: task,
    };
  }

  async getMyTasks(userId: string, query: QueryTaskDto) {
    const paginationOptions = paginationHelper.calculatePagination({
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const whereConditions: Prisma.TaskWhereInput = {
      userId,
    };

    // 1. Text Search Filter
    if (query.search) {
      whereConditions.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // 2. Status Filter
    if (query.status) {
      whereConditions.status = query.status;
    }

    // 3. Date Range Filter
    if (query.startDate || query.endDate) {
      whereConditions.createdAt = {};
      
      if (query.startDate) {
        whereConditions.createdAt.gte = new Date(query.startDate);
      }
      
      if (query.endDate) {
        // Extend to end of the day
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        whereConditions.createdAt.lte = end;
      }
    }

    const tasks = await this.prisma.task.findMany({
      where: whereConditions,
      skip: paginationOptions.skip,
      take: paginationOptions.limit,
      orderBy: {
        [paginationOptions.sortBy]: paginationOptions.sortOrder,
      },
    });

    const total = await this.prisma.task.count({ where: whereConditions });

    return {
      message: 'Tasks retrieved successfully',
      meta: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
        total,
      },
      data: tasks,
    };
  }

  async getTaskById(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new UnauthorizedException('You do not own this task');
    }

    return {
      message: 'Task retrieved successfully',
      data: task,
    };
  }

  async updateTask(userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new UnauthorizedException('You are not authorized to update this task');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.status && { status: dto.status }),
      },
    });

    return {
      message: 'Task updated successfully',
      data: updatedTask,
    };
  }

  async markAsCompleted(userId: string, taskId: string) {
    return this.updateTask(userId, taskId, { status: TaskStatus.COMPLETED });
  }

  async deleteTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new UnauthorizedException('You are not authorized to delete this task');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return {
      message: 'Task deleted successfully',
      data: { id: taskId },
    };
  }
}
```

#### `src/modules/task/task.controller.ts`
```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { TrimPipe } from '../../common/pipes/trim.pipe';

@Controller('tasks')
@UseGuards(AuthGuard)
export class TaskController {
  constructor(private taskService: TaskService) {}

  @Post()
  @UsePipes(new TrimPipe())
  async createTask(@CurrentUser('userId') userId: string, @Body() dto: CreateTaskDto) {
    return this.taskService.createTask(userId, dto);
  }

  @Get()
  async getMyTasks(@CurrentUser('userId') userId: string, @Query() query: QueryTaskDto) {
    return this.taskService.getMyTasks(userId, query);
  }

  @Get(':id')
  async getTaskById(@CurrentUser('userId') userId: string, @Param('id') taskId: string) {
    return this.taskService.getTaskById(userId, taskId);
  }

  @Patch(':id')
  @UsePipes(new TrimPipe())
  async updateTask(
    @CurrentUser('userId') userId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto
  ) {
    return this.taskService.updateTask(userId, taskId, dto);
  }

  @Patch(':id/completed')
  async markAsCompleted(@CurrentUser('userId') userId: string, @Param('id') taskId: string) {
    return this.taskService.markAsCompleted(userId, taskId);
  }

  @Delete(':id')
  async deleteTask(@CurrentUser('userId') userId: string, @Param('id') taskId: string) {
    return this.taskService.deleteTask(userId, taskId);
  }
}
```

#### `src/modules/task/task.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
```

---

## 11. Application Configuration & Bootstrap

Connect all pipes, filters, interceptors, and modules together inside the main files.

### `src/app.module.ts`
```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { TaskModule } from './modules/task/task.module';
import { apiLimiter, authLimiter } from './common/middlewares/rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    UserModule,
    TaskModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Register windowed rate limiting middlewares
    consumer.apply(authLimiter).forRoutes('auth/login', 'auth/verify-otp');
    consumer.apply(apiLimiter).forRoutes('tasks', 'users');
  }
}
```

### `src/main.ts`
```typescript
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Parse request cookies
  app.use(cookieParser());

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Standard Nest DTO validation configurations
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove unrecognized fields
      forbidNonWhitelisted: true, // throw exception if extra fields exist
      transform: true, // auto-convert path/query parameters
    }),
  );

  // Centralize all outputs
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server is running successfully on http://localhost:${port}`);
}

bootstrap();
```

---

## 12. Automated Testing Examples

### Unit Test: `src/modules/task/task.service.spec.ts`
Tests task creation, fetch logic with query filters, updates, and deletes.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('TaskService', () => {
  let service: TaskService;
  let prisma: PrismaService;

  const mockPrismaService = {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a task successfully', async () => {
    const dto = { title: 'Test Task', description: 'Test Desc' };
    const mockTask = { id: 'task-1', title: 'Test Task', description: 'Test Desc', userId: 'user-1', status: TaskStatus.PENDING };
    mockPrismaService.task.create.mockResolvedValue(mockTask);

    const result = await service.createTask('user-1', dto);

    expect(result.data).toEqual(mockTask);
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: { title: dto.title, description: dto.description, userId: 'user-1' },
    });
  });

  it('should get task by ID if owned by user', async () => {
    const mockTask = { id: 'task-1', title: 'Test Task', userId: 'user-1' };
    mockPrismaService.task.findUnique.mockResolvedValue(mockTask);

    const result = await service.getTaskById('user-1', 'task-1');
    expect(result.data).toEqual(mockTask);
  });

  it('should throw UnauthorizedException if task not owned by requesting user', async () => {
    const mockTask = { id: 'task-1', title: 'Test Task', userId: 'user-2' };
    mockPrismaService.task.findUnique.mockResolvedValue(mockTask);

    await expect(service.getTaskById('user-1', 'task-1')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw NotFoundException if task does not exist', async () => {
    mockPrismaService.task.findUnique.mockResolvedValue(null);

    await expect(service.getTaskById('user-1', 'task-invalid')).rejects.toThrow(
      NotFoundException,
    );
  });
});
```

### E2E Integration Test: `test/auth.e2e-spec.ts`
Tests Registration and Login validation endpoints.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/register (POST) - Error if email invalid', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bad-email', password: '123' })
      .expect(400)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('email');
      });
  });

  it('/auth/login (POST) - Error if credentials missing', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: '' })
      .expect(400);
  });
});
```

To execute tests, use the standard commands:
```bash
# Run unit tests
npm run test

# Run End-To-End (e2e) tests
npm run test:e2e
```
