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
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { comparePassword, hashPassword } from '../../common/utils/hash.util';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { Role } from '../../common/enums/roles.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) { }

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
        isVerified: true, // Auto-verify since OTP is removed
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    this.logger.log(`New user registered: ${user.email}`);

    return {
      message: 'Registration successful. You can now login.',
      data: user,
    };
  }

  // ─── LOGIN ───────────────────────────────────────────────────────────────────

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

    // Auto-verify legacy unverified accounts
    if (!user.isVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role as Role);

    return {
      message: 'Login successful',
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  // ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('app.jwt.refresh_token_secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
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
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  // ─── LOGOUT ───────────────────────────────────────────────────────────────────

  async logout() {
    // In a stateless JWT architecture without Redis, logout is typically handled client-side
    // by deleting the tokens.
    return { message: 'Logged out successfully', data: null };
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('app.jwt.jwt_secret'),
        expiresIn: this.config.get<string>('app.jwt.expires_in') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('app.jwt.refresh_token_secret'),
        expiresIn: this.config.get<string>('app.jwt.refresh_token_expires_in') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}