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
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── USER: Own Profile ─────────────────────────────────────────────────────

  // GET /api/v1/users/me
  @Get('me')

  @ApiOperation({ summary: 'Get own profile' })
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(user.sub);
  }

  // PATCH /api/v1/users/me
  @Patch('me')

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

  @ApiOperation({ summary: '[Admin] Get user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // PATCH /api/v1/users/:id  (admin only)
  @Patch(':id')
  @Roles(Role.ADMIN)

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

  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Suspend user' })
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.suspendUser(id);
  }

  // PATCH /api/v1/users/:id/activate  (admin only)
  @Patch(':id/activate')
  @Roles(Role.ADMIN)

  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Activate user' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activateUser(id);
  }

  // DELETE /api/v1/users/:id  (admin only — soft delete)
  @Delete(':id')
  @Roles(Role.ADMIN)

  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Soft-delete user' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deleteUser(id);
  }
}