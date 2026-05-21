import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;

  // Set global prefix and exclude root '/' route
  app.setGlobalPrefix('api/v1', { exclude: ['/'] });

  // Use the global exception filter to handle all errors (including 404 Not Found)
  app.useGlobalFilters(new GlobalExceptionFilter(configService));

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
