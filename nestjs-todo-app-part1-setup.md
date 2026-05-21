# NestJS Todo App — Full Production Guide
## Part 1: Setup · Prisma Schema · Config · Folder Structure

---

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
