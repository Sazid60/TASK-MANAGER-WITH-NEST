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