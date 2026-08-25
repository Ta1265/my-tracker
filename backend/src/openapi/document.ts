import { DocumentBuilder } from '@nestjs/swagger';

export const GLOBAL_PREFIX = 'backend/api';

export function createOpenApiDocumentBuilder(): DocumentBuilder {
  return new DocumentBuilder()
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
    .addTag('Metrics');
}
