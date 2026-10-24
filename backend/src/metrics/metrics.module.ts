import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

// Global, like RedisModule: MetricsService is a cross-cutting dependency of the
// exchange-rates/price-history/summary services and the global HTTP interceptor
// registered directly in main.ts, not just of this module's own controller.
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
