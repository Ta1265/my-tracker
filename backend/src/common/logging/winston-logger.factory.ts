import { LoggerService } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ClsServiceManager } from 'nestjs-cls';
import winston from 'winston';

// Reads a request id from CLS if a request is active (nestjs-cls's documented hook for
// reading context outside Nest's DI, e.g. from a plain winston format function). Absent
// during boot-time logs, where no CLS context exists yet.
const addRequestId = winston.format((info) => {
  const cls = ClsServiceManager.getClsService();
  if (cls.isActive()) {
    info.requestId = cls.getId();
  }
  return info;
});

export function createWinstonLogger(): LoggerService {
  return WinstonModule.createLogger({
    instance: winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        addRequestId(),
        winston.format.json(),
      ),
      defaultMeta: {
        service: 'portfolio',
        environment: process.env.NODE_ENV,
      },
      transports: [new winston.transports.Console()],
    }),
  });
}
