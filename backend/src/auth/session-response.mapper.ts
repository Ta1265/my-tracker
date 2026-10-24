import { SessionClaims } from '@portfolio/shared';
import { LoginResponseDto } from './dto/login-response.dto';

// Whitelists the response shape: rememberMe, jti, iat, and exp never leave the backend.
// Shared by login and the session endpoint so both stay in sync with a single mapping.
export function toSessionResponse(claims: SessionClaims): LoginResponseDto {
  return {
    isAuthenticated: true,
    user: {
      id: claims.sub,
      username: claims.username,
      email: claims.email,
      name: claims.name,
    },
  };
}
