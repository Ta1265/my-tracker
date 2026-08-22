import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { createWinstonLogger } from './common/logging/winston-logger.factory';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: createWinstonLogger() });
  app.setGlobalPrefix('backend/api');
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Permissive by design: must never reject a request the existing Next.js routes
  // accept. No business-rule validators live here - just shape/type coercion.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }),
  );

  const appConfigService = app.get(AppConfigService);
  if (appConfigService.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Portfolio API')
        .setDescription('Backend API for the portfolio tracker, migrated from Next.js API routes.')
        .setVersion('1.0')
        .addCookieAuth('portfolio_session', {
          type: 'apiKey',
          in: 'cookie',
          name: 'portfolio_session',
        })
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'metrics-secret')
        .addTag('Auth')
        .addTag('Transactions')
        .addTag('Summary')
        .addTag('Stats')
        .addTag('Product')
        .addTag('Exchange Rates')
        .addTag('Price History')
        .addTag('Time-Frame P&L')
        .addTag('Token Info')
        .addTag('Metrics')
        .build(),
    );
    SwaggerModule.setup('backend/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
