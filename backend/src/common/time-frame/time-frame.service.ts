import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../clock/clock';

@Injectable()
export class TimeFrameService {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  // Ports time-frame-coins-pl/[timeFrame]/route.ts:7-21's switch exactly, seeded from
  // the injected clock rather than reading the system clock directly. Uses `Date`'s own
  // setMonth/setFullYear mutation rather than dayjs's subtract: on a month/year-end date
  // dayjs clamps an out-of-range day to the shorter month's last day, while `Date`
  // overflows it into the following month - the two produce different cutoffs, and this
  // keeps the value that `pastPl` was already computed against.
  getStartDate(timeFrame: string): Date {
    const now = new Date(this.clock.now());

    switch (timeFrame) {
      case 'h':
        now.setHours(now.getHours() - 1);
        break;
      case 'd':
        now.setDate(now.getDate() - 1);
        break;
      case 'w':
        now.setDate(now.getDate() - 7);
        break;
      case 'm':
        now.setMonth(now.getMonth() - 1);
        break;
      case '3m':
        now.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        now.setMonth(now.getMonth() - 6);
        break;
      case 'y':
        now.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        now.setFullYear(now.getFullYear() - 100);
        break;
      default:
        throw new Error('Unsupported time frame: ' + timeFrame);
    }

    return now;
  }
}
