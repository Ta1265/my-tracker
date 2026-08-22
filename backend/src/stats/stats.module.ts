import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatsController } from './stats.controller';

@Module({
  imports: [AuthModule],
  controllers: [StatsController],
})
export class StatsModule {}
