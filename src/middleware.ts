export { default } from 'next-auth/middleware';

export const config = { matcher: ['/stats', '/product/:path*'] };
