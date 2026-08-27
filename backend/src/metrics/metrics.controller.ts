import { Controller, Get, Headers, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Get()
  @ApiSecurity('metrics-secret')
  @ApiOperation({
    operationId: 'metrics',
    description:
      'Authenticated via a static bearer-token check (Authorization: Bearer {METRICS_SECRET}), ' +
      'not a session - this is a machine-to-machine scrape credential, never a user-facing ' +
      'route, so it is documented with its own bearer security scheme rather than ' +
      '@ApiCookieAuth().',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus text exposition format',
    content: { 'text/plain': { schema: { type: 'string' } } },
  })
  @ApiResponse({
    status: 403,
    description: 'Missing/incorrect bearer token, or METRICS_SECRET unset.',
    content: { 'text/plain': { schema: { type: 'string', example: 'Forbidden' } } },
  })
  // Writes the response directly via `@Res({ passthrough: false })` so a 403 reaches
  // the client as plain text `Forbidden`, not AllExceptionsFilter's
  // `{ error: 'Forbidden' }` wrapping - throwing ForbiddenException() would go through
  // that filter.
  async getMetrics(
    @Headers('authorization') authHeader: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const { metricsSecret } = this.appConfigService;

    if (!metricsSecret || authHeader !== `Bearer ${metricsSecret}`) {
      res.status(403).type('text/plain').send('Forbidden');
      return;
    }

    res
      .status(200)
      .set('Content-Type', this.metricsService.registry.contentType)
      .send(await this.metricsService.registry.metrics());
  }
}
