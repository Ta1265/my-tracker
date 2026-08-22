import { Injectable } from '@nestjs/common';
import { Clock } from './clock';

// The only place in backend/src a bare `new Date()` is permitted - every other
// consumer injects `Clock` instead.
@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
