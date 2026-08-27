import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from './redis';

// Host/port match frontend/src/server/redisClient.ts and docker-compose.yml's `redis`
// service exactly (no auth, no TLS, single Compose network) - no env var needed.
@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: () => new Redis({ host: 'redis', port: 6379 }) }],
  exports: [REDIS],
})
export class RedisModule {}
