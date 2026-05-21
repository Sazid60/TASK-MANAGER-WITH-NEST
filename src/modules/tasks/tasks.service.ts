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

    let completedAt: Date | null | undefined = undefined;
    if (dto.status === 'COMPLETED') {
      completedAt = new Date();
    } else if (dto.status === 'PENDING' || dto.status === 'IN_PROGRESS') {
      completedAt = null;
    }

    const updateData: Prisma.TaskUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
      ...(dto.status !== undefined && {
        status: dto.status,
        completedAt,
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