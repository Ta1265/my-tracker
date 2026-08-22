import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SummaryController } from './summary.controller';

@Module({
  imports: [AuthModule],
  controllers: [SummaryController],
})
export class SummaryModule {}
