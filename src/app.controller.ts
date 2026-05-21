import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Welcome route' })
  getWelcome() {
    return {
      success: true,
      message: 'Welcome to NestJS Task Manager API!',
      version: '1.0.0',
    };
  }
}
