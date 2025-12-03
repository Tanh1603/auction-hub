/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionFilter } from './common/filters/exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Use ConfigService to read allowed origins from environment (ALLOWED_ORIGINS or FRONTEND_URL).
  // This enables secure CORS for HTTP endpoints and keeps behavior consistent with websockets.
  // Allow all origins for development / requested behaviour
  // Note: Access-Control-Allow-Credentials is not set when using a wildcard origin
  // because browsers will reject '*' together with credentials. If you need
  // credentials with multiple origins, consider using a reflected origin policy.
  app.enableCors({ origin: '*' });
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Auction-Hub API')
    .setDescription('The Auction API description')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/docs', app, documentFactory);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
