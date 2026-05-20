// Import the Controller and Get decorators from NestJS
import { Controller, Get } from '@nestjs/common';
// Import the AppService which contains the business logic
import { AppService } from './app.service';

// Mark this class as a NestJS controller (handles incoming HTTP requests)
@Controller()
export class AppController {
  // Inject AppService via the constructor and make it a private readonly property
  constructor(private readonly appService: AppService) {}

  // Handle GET requests to the root path ('/')
  @Get()
  getHello(): string {
    // Call the getHello method from AppService and return its result
    return this.appService.getHello();
  }
}
