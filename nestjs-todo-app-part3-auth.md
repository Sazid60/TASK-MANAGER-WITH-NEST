# NestJS Todo App — Part 3: Auth Module
## Registration · OTP Login · JWT Strategy · Refresh Tokens

---

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
