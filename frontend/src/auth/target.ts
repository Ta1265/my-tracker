// The single place NEXT_PUBLIC_AUTH_TARGET is read and defaulted. Every other file in
// this seam imports getAuthTarget() rather than reading the env var itself.
export function getAuthTarget(): 'legacy' | 'nest' {
  return process.env.NEXT_PUBLIC_AUTH_TARGET === 'nest' ? 'nest' : 'legacy';
}
