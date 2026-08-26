import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
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
  // Check Authorization: Bearer {METRICS_SECRET} exactly; on match, return
  // register.metrics()'s Prometheus exposition text; on mismatch, 403 plain-text
  // Forbidden.
  async getMetrics(): Promise<string> {
    throw new NotImplementedException();
  }
}
