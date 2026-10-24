import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { GLOBAL_PREFIX } from '../../openapi/document';

// Prometheus scrapes /metrics and Docker probes /health, both every 15s. Either would
// dominate the request log without ever describing user-facing traffic.
const UNLOGGED_PATHS = new Set([`/${GLOBAL_PREFIX}/metrics`, `/${GLOBAL_PREFIX}/health`]);

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (UNLOGGED_PATHS.has(request.path)) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    // Logged on 'finish' rather than an rxjs `tap`: Nest sets the final status code only
    // after this interceptor's observable resolves, so a `tap` would read a stale one.
    response.on('finish', () => {
      this.logger.log({
        message: 'Request completed',
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Number(process.hrtime.bigint() - start) / 1e6,
        // nginx sets X-Real-IP on both proxied locations; request.ip would report the
        // proxy's own address unless Express is told to trust it.
        ip: request.header('x-real-ip') ?? request.ip,
      });
    });

    return next.handle();
  }
}
