import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    // Recorded on the response's 'finish' event rather than via an rxjs `tap` on
    // next.handle(): Nest only sets the final status code (via its response
    // controller, or via AllExceptionsFilter on a thrown error) *after* the
    // interceptor's own observable pipeline resolves, so a `tap` here would read a
    // stale status_code. 'finish' fires once the response is actually sent, on every
    // outcome (success, thrown exception, or manual @Res() write).
    response.on('finish', () => {
      // Falls back to a constant label rather than the raw URL for unmatched routes
      // (404s, scanner traffic) - request.route is only set once Nest/Express have
      // matched a route, and the raw path would reintroduce the per-value cardinality
      // explosion the matched-route path is meant to avoid. Express types `Request.route`
      // as `any`, so it's narrowed explicitly here.
      const route = request.route as { path?: string } | undefined;
      const path = route?.path ?? 'unmatched';
      const labels = { method: request.method, path };
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

      this.metricsService.httpRequestsTotal.inc({
        ...labels,
        status_code: String(response.statusCode),
      });
      this.metricsService.httpRequestDuration.observe(labels, durationMs);
    });

    return next.handle();
  }
}
