import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { db } from './db/db';
import logger from './logger';
// import { encode, decode } from 'next-auth/jwt';
// import Cookies from 'cookies';
// import { randomUUID } from 'crypto';

// /**
//  * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
//  * object and keep type safety.
//  *
//  * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
//  */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    isAuthenticated: boolean;
    user: DefaultSession['user'] & {
      id: number;
      username: string;
      name: string | null;
      email: string;
      // ...other properties
      // role: UserRole;
    };
  }

  interface User {
    id: number;
    username: string;
    name: string | null;
    email: string;
    // ...other properties
    // role: UserRole;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  pages: {
    signIn: '/login',
    error: '/error',
  },
  session: {
    strategy: 'jwt',
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days (max when rememberMe is true)
  },
  callbacks: {
    // Called after authorize() succeeds. Returning false blocks the sign-in.
    // Here we just verify authorize() returned a user — if it returned null,
    // NextAuth already rejected the attempt before reaching this callback.
    async signIn({ user, account, profile, email, credentials }) {
      if (!user) {
        return false;
      }
      return true;
    },
    // Called to determine where to send the user after sign-in.
    // We pass redirect: false from the client so the actual navigation is handled
    // manually, but this still runs to produce result.url. We restrict to same-origin
    // URLs to prevent open-redirect attacks.
    async redirect({ url, baseUrl }) {
      // Allow redirects to URLs within the same baseUrl (safe), otherwise
      // fall back to the baseUrl to avoid returning to untrusted origins.
      try {
        if (typeof url === 'string' && url.startsWith(baseUrl)) {
          return url;
        }
      } catch (e) {
        // ignore and fall through
      }
      return baseUrl;
    },

    // Called on every JWT operation: initial sign-in, session reads, and token refreshes.
    // `user` is only defined on the very first call (sign-in), populated from authorize().
    // On all subsequent calls (session reads) `user` is undefined, so we skip the if block
    // and just return the existing token — no DB call needed, all data lives in the cookie.
    async jwt({ token, user, account, profile, isNewUser }) {
      if (user) {
        // First sign-in: copy user fields from authorize() into the token payload.
        // These are encrypted into the session cookie and carried forward on every request.
        token.username = user.username;
        token.email = user.email;
        token.name = user.name;
        token.userId = user.id;
        token.rememberMe = (user as any).rememberMe === true;

        // If rememberMe is false, expire the token in 8 hours instead of the default 30 days.
        if (!token.rememberMe) {
          token.exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
        }
      }

      // Subsequent calls: token already has all the data, just return it as-is.
      return token;
    },
    // Called after jwt() whenever a session is needed — in server components via
    // getServerSession(), or on the client via useSession() (which fetches /api/auth/session).
    // Receives the already-decoded token and shapes what callers actually see.
    // This is a whitelist step: only explicitly mapped fields are exposed, so internal
    // token fields (like rememberMe or raw exp) are never leaked to calling code.
    async session({ session, user, token }) {
      if (!token || !token.userId) {
        return {
          ...session,
          isAuthenticated: false,
        };
      }
      return {
        ...session,
        isAuthenticated: true,
        user: {
          username: token.username,
          email: token.email,
          name: token.name,
          id: token.userId,
        },
      };
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text', placeholder: 'jsmith' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'text' },
      },
      async authorize(credentials): Promise<{
        id: number;
        username: string;
        email: string;
        name: string | null;
        rememberMe: boolean;
      } | null> {
        const { username, password, rememberMe } = credentials ?? {};
        if (!username || !password) return null;

        const user = await db.user
          .findFirst({
            where: { username: username.toLowerCase() },
          })
          .catch((error) => { logger.error('Auth Error', { error }); return null; });

        if (!user) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          logger.warn('Invalid password attempt', { username: user.username });
          return null;
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          rememberMe: rememberMe === 'true',
        };
      },
    }),
    // Passwordless / email sign in
    // EmailProvider({
    //   server: process.env.MAIL_SERVER,
    //   from: 'NextAuth.js <no-reply@example.com>',
    // }),
    //
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

// App Router compatible — no req/res needed, reads cookies from Next.js headers
export const getServerAuthSession = () => getServerSession(authOptions);
