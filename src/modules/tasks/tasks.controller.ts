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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // POST /api/v1/tasks
  @Post()

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

  @ApiOperation({ summary: 'Get a single task by ID' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.findOne(id, user.sub, user.role);
  }

  // PATCH /api/v1/tasks/:id
  @Patch(':id')

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

  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.remove(id, user.sub, user.role);
  }
}