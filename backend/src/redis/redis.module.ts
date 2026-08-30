import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from './redis';

@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: () => new Redis({ host: 'redis', port: 6379 }) }],
  exports: [REDIS],
})
export class RedisModule {}
