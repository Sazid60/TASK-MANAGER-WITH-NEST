# NestJS Todo App — Part 4: Users & Tasks Modules
## Full CRUD · Pagination · Search · Sort · Filter · Date Range

---

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
