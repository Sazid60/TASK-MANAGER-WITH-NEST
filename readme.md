```
Controller → Route handling
Service → Logic
Module → Grouping
```

```ts
@Controller('flats')
export class FlatsController {
  @Get(':flatId/meters')
  getMeters(@Param('flatId') flatId: string) {
    return `Meters of flat ${flatId}`;
  }

  @Get(':flatId/meters/:meterId')
  getMeter(@Param('flatId') flatId: string, @Param('meterId') meterId: string) {
    return `Meter ${meterId} of flat ${flatId}`;
  }
}
```

```
POST /bill
      ↓
BillingController
      ↓
BillingService
      ↓
Prisma (DB)
      ↓
PostgreSQL
      ↓
Response
```

```
Middleware
↓
Guards
↓
Interceptors (before)
↓
Pipes
↓
Controller
↓
Service
↓
Controller returns
↓
Interceptors (after)
↓
Exception Filter (if error)
```

# DTO

```ts
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  IsInt,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

import { Type, Transform } from 'class-transformer';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  country: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ValidateIf((o) => o.age !== undefined)
  @IsInt()
  @Min(18)
  age?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
```

- partial od dtos

```ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

- query DTO

```ts
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}
```

- conditional DTO

```ts
import { ValidateIf, IsString } from 'class-validator';

export class PaymentDto {
  @IsString()
  method: string;

  @ValidateIf((o) => o.method === 'card')
  @IsString()
  cardNumber?: string;

  @ValidateIf((o) => o.method === 'bkash')
  @IsString()
  bkashNumber?: string;
}
```

```
src/
 ├── users/
 │    ├── dto/
 │    │    ├── create-user.dto.ts
 │    │    ├── update-user.dto.ts
 │    │    ├── login.dto.ts
 │    │    ├── query-user.dto.ts
 │    │    ├── user-response.dto.ts
```

```
Request → Pipe (ValidationPipe) → DTO → Controller → Service → DB
```

- enabling the dto features

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove extra fields
      forbidNonWhitelisted: true, // error if extra fields sent
      transform: true, // auto convert types
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

- using DTOs in controller

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
```

```
1. Request comes from frontend
        ↓
2. NestJS receives it in Controller
        ↓
3. ValidationPipe runs automatically
        ↓
4. DTO rules are checked
        ↓
5. If OK → goes to Service
        ↓
6. If NOT OK → error returned instantly
```

```
1. Request arrives
2. Global Pipe runs
3. ValidationPipe checks DTO rules
4. Finds errors
5. Throws 400 error automatically
6. Controller NEVER runs
```

- Without pipe ❌ Bad data still reaches controller.
-

#### types of pipe usage

- GLOBAL PIPE (Whole Application)

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

```
Request → Global Pipe → Controller
```

- CONTROLLER PIPE (Only one controller)

```ts
import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
@UsePipes(new ValidationPipe()) // 👈 controller-level pipe
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return dto;
  }
}
```

- ROUTE PIPE (Single API only)

```ts
import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Post()
  @UsePipes(new ValidationPipe()) // 👈 only this route
  create(@Body() dto: CreateUserDto) {
    return dto;
  }

  @Post('admin')
  createAdmin(@Body() dto: CreateUserDto) {
    return dto;
  }
}
```

- BUILT-IN PIPES (VERY IMPORTANT)
  1. A. ParseIntPipe (MOST USED)

  ```ts
  import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
  @Controller('users')
  export class UsersController {
    @Get(':id')
    getUser(@Param('id', ParseIntPipe) id: number) {
      return {
        id,
        type: typeof id,
      };
    }
  }
  ```

  2. B. ParseBoolPipe

  ```ts
  import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
  @Controller('users')
  export class UsersController {
    @Get(':id')
    getUser(@Param('id', ParseIntPipe) id: number) {
      return {
        id,
        type: typeof id,
      };
    }
  }
  ```

  3. C. ParseUUIDPipe

  ```ts
  @Get(':id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return id;
    }
  ```

  4. Custom Pipe

  ```ts
  import { PipeTransform, Injectable } from '@nestjs/common';
  @Injectable()
  export class TrimPipe implements PipeTransform {
    transform(value: any) {
      if (typeof value === 'string') {
        return value.trim();
      }
      return value;
    }
  }
  ```

  ```ts
  @Post()
  create(
  @Body('name', TrimPipe) name: string,
  ) {
  return name;
  }

  ```

# Middlewares

```
Request → Middleware → Guard → Pipe → Controller → Service
```

- What your middleware is doing

```ts
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    console.log('Incoming Request:', req.method, req.url);

    req.requestTime = Date.now();

    next();
  }
}
```

- 🔥 3. Where middleware runs in real life

```
Middleware runs:

BEFORE guards
BEFORE pipes
BEFORE controll
```

```
Request
  ↓
Middleware   ← (your logger runs here)
  ↓
Guard        (auth check)
  ↓
Pipe         (validation)
  ↓
Controller
  ↓
Service
  ↓
Response
```

#### How to apply middleware

- Option 1: Module-level middleware

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from './logger.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
```

- Option 2: Specific route

```ts
consumer.apply(LoggerMiddleware).forRoutes('users');
```

- Option 3: Specific controller

```ts
.forRoutes(UsersController);

```

#### 5. Real-world use cases of middlewares

- 1. Logging (MOST COMMON)

```ts
console.log(req.method, req.url, Date.now());
```

- 2. Authentication token extraction

```ts
const token = req.headers.authorization;
req.userToken = token;
```

- 3. Request tracking (request ID)

```ts
req.requestId = crypto.randomUUID();
```

- 4. Performance timing

```ts
const start = Date.now();

res.on('finish', () => {
  console.log('Time:', Date.now() - start);
});
```

- 5. Request modification

```ts
req.body.email = req.body.email.toLowerCase();
```

- 6. Blocking requests (rare)

```ts
if (!req.headers.authorization) {
  res.status(401).send('Unauthorized');
  return;
}
```
# GUARDS

- 👉 A Guard is a security checkpoint that decides:

“Can this request ENTER the controller or not?”

```
Request → Door → Security Guard → Inside Club (Controller)
```

```
Middleware = gate entry logging
Pipe = checking form/data
Guard = “Are you allowed inside?
```

```
Request
  ↓
Middleware
  ↓
Guard        👈 HERE (security decision)
  ↓
Pipe
  ↓
Controller
  ↓
Service
```

### 3. What your Guard code is doing

```ts
canActivate(context: ExecutionContext): boolean {
```

👉 This function MUST return:

- true → allow request
- false → block request

#### Step-by-step breakdown
- 1. Get request object
  
  ```ts 
  const req = context.switchToHttp().getRequest();
  ```
  👉 This gives you access to:

  ```
  req.headers
  req.body
  req.params
  req.user
  ```
- 2. Read token
  
  ```ts
  const token = req.headers.authorization;
  ```
- 👉 Example request:

  ```ts
  Authorization: Bearer abc123
  ```
- 3. Check condition
  
  ```ts
  if (!token) {
  return false;
  }
  ```
👉 If no token → BLOCK request

- 4. Allow request

```ts
return true;
```
```
Request → Guard → ❌ false → STOP → 403 Forbidden
```

```
Request → Guard → true → Controller runs
```

##### 6. REAL PRODUCTION GUARD (JWT example)

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token found');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = this.jwtService.verify(token);

      req.user = decoded; // attach user info
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

- guards can access

```
Request headers
Request body
Request params
Request cookies
```

#### 9. Where you use Guard

- controller level 

```ts
@UseGuards(AuthGuard)
@Controller('users')
export class UsersController {}
```

- route level 

```ts 
@UseGuards(AuthGuard)
@Get()
findAll() {}
```

- global guard 

```ts 
app.useGlobalGuards(new AuthGuard());
```

| Feature           | Middleware    | Guard             |
| ----------------- | ------------- | ----------------- |
| Purpose           | preprocessing | security decision |
| Knows route       | ❌             | ✅                 |
| Can block request | basic         | proper NestJS way |
| Returns           | next()        | true/false        |
| Use case          | logging       | authentication    |



| Feature          | Best Layer             | Why                   |
| ---------------- | ---------------------- | --------------------- |
| Rate Limiting    | Guard (ThrottlerGuard) | blocks requests early |
| JWT Access Token | Guard                  | auth decision         |
| Refresh Token    | Controller (Auth API)  | special endpoint only |
| Input validation | Pipe                   | clean data            |
| Logging          | Middleware             | first entry           |


# Interceptors (Before and After)

```
Request
  ↓
Middleware
  ↓
Guard
  ↓
Interceptor (before)
  ↓
Pipe
  ↓
Controller
  ↓
Service
  ↓
Interceptor (after)
  ↓
Exception Filter (only if error)
  ↓
Response
```

- 👉 Interceptor = “wraps request BEFORE and AFTER controller”


```ts
intercept(context: ExecutionContext, next: CallHandler) {
```

- 1. BEFORE controller

```ts 
console.log('Before Controller');
```

- 2. next.handle()
- “Run controller now and give me its result later”
- 3. AFTER controller (VERY IMPORTANT)
```ts 
.pipe(
  map((data) => ({
    success: true,
    data
  }))
)
```

```
Request → Interceptor (before)
        → Controller
        → Interceptor (after modifies response)
        → Response sent
```
### 💡 WHY INTERCEPTOR EXISTS

- 1. Response formatting

```ts 
{ success: true, data: ... }
```
- 2. Logging execution time

```ts 
const start = Date.now();

return next.handle().pipe(
  tap(() => {
    console.log(Date.now() - start);
  })
);
```

```
| Layer       | Meaning               |
| ----------- | --------------------- |
| Middleware  | request enters system |
| Guard       | allowed or not        |
| Pipe        | is data valid         |
| Controller  | route handler         |
| Service     | business logic        |
| Interceptor | wrap before/after     |
| Filter      | error handling        |

```


```ts 
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common';

import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {

  intercept(context: ExecutionContext, next: CallHandler) {

    console.log('Before Controller');

    return next.handle().pipe(

      map((data) => ({
        success: true,
        data
      }))

    );
  }
}
```

```ts
app.useGlobalInterceptors(new ResponseInterceptor());
```

# Exception Handling 

- 7. EXCEPTION FILTER (ERROR HANDLING)
```ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {

  catch(exception: any, host: ArgumentsHost) {

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    response.status(500).json({
      success: false,
      message: exception.message || 'Internal Error'
    });
  }
}
```

```ts
app.useGlobalFilters(new AllExceptionsFilter());
```