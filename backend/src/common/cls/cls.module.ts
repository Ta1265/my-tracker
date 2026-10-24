import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { ClsModule } from 'nestjs-cls';

export const RequestClsModule = ClsModule.forRoot({
  middleware: {
    mount: true,
    generateId: true,
    // Adopts nginx's $request_id, forwarded as X-Request-Id, so one id spans the proxy
    // access log and this service. nginx always overwrites the inbound header.
    idGenerator: (req: Request) => {
      const header = req.headers['x-request-id'];
      return (Array.isArray(header) ? header[0] : header) ?? randomUUID();
    },
  },
});
