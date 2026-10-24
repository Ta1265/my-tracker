import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ApiOperation } from '@nestjs/swagger';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly em: EntityManager) {}

  @Get()
  @ApiOperation({ operationId: 'health' })
  async check() {
    try {
      await this.em.getConnection().execute(/* SQL */ `SELECT 1`);
    } catch (error) {
      this.logger.error({ message: 'Database health check failed', error });
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return { status: 'ok', database: 'up' };
  }
}
