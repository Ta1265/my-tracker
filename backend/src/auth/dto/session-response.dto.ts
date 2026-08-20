// Identical shape to LoginResponseDto's success body, so /session reuses the same DTO
// class rather than declaring a duplicate one.
export { LoginResponseDto as SessionResponseDto } from './login-response.dto';
