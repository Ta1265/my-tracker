import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ operationId: 'health' })
  check() {
    return { status: 'ok' };
  }
}
