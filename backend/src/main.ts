import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { createWinstonLogger } from './common/logging/winston-logger.factory';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { MetricsService } from './metrics/metrics.service';
import { createOpenApiDocumentBuilder, GLOBAL_PREFIX } from './openapi/document';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: createWinstonLogger(),
  });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  // App Router route handlers enforce no body-size limit, so the price-history payloads
  // (a coin's full daily series, ~250KB and growing) exceed Express's 100KB default.
  app.useBodyParser('json', { limit: '10mb' });
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new HttpMetricsInterceptor(app.get(MetricsService)),
  );

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

  // Without this MikroORM's onApplicationShutdown never fires, so the pool is never closed.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
