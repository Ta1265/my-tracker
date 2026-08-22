import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TimeFrameCoinsPlController } from './time-frame-coins-pl.controller';
import { TimeFrameTotalPlController } from './time-frame-total-pl.controller';

@Module({
  imports: [AuthModule],
  controllers: [TimeFrameCoinsPlController, TimeFrameTotalPlController],
})
export class TimeFramePlModule {}
