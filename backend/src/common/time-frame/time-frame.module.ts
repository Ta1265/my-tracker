import { Module } from '@nestjs/common';
import { TimeFrameService } from './time-frame.service';

@Module({
  providers: [TimeFrameService],
  exports: [TimeFrameService],
})
export class TimeFrameModule {}
