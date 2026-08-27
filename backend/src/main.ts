import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { createWinstonLogger } from './common/logging/winston-logger.factory';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { MetricsService } from './metrics/metrics.service';
import { createOpenApiDocumentBuilder, GLOBAL_PREFIX } from './openapi/document';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: createWinstonLogger() });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new HttpMetricsInterceptor(app.get(MetricsService)));

  // Permissive by design: must never reject a request the existing Next.js routes
  // accept. No business-rule validators live here - just shape/type coercion.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
  );

  const appConfigService = app.get(AppConfigService);
  if (appConfigService.swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, createOpenApiDocumentBuilder().build());
    SwaggerModule.setup('backend/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
