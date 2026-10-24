import { SessionClaims } from '@portfolio/shared';

declare global {
  namespace Express {
    interface Request {
      user?: SessionClaims;
    }
  }
}
