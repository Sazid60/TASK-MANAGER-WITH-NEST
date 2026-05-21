import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  @Get()
  getWelcome() {
    return {
      success: true,
      message: 'Welcome to NestJS Task Manager API!',
      version: '1.0.0',
    };
  }
}
