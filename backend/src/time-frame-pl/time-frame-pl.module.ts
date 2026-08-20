import { Module } from '@nestjs/common';
import { TimeFrameCoinsPlController } from './time-frame-coins-pl.controller';
import { TimeFrameTotalPlController } from './time-frame-total-pl.controller';

@Module({
  controllers: [TimeFrameCoinsPlController, TimeFrameTotalPlController],
})
export class TimeFramePlModule {}
