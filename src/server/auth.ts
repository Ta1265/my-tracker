import { type GetServerSidePropsContext } from 'next';
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { db } from './db/db';
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
    //   signIn: '/login',
    error: '/error',
  },
  session: {
    strategy: 'jwt',
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 60, //30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      if (!user) {
        return false;
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      return baseUrl;
    },

    async jwt({ token, user, account, profile, isNewUser }) {
      // user comes from the authorize fn, add user stuff to the token here
      if (user) {
        token.username = user.username;
        token.email = user.email;
        token.name = user.name;
        token.userId = user.id;
      }

      return token;
    },
    async session({ session, user, token }) {
      // grab user stuff from the token and add it to the session here
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
      },
      async authorize({ username, password }): Promise<{
        id: number;
        username: string;
        email: string;
        name: string | null;
      } | null> {
        const user = await db.user
          .findFirst({
            where: { username },
          })
          .catch((error) => console.error('Auth Error: ', error));

        if (!user) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
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

// /**
//  * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
//  *
//  * @see https://next-auth.js.org/configuration/nextjs
//  */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext['req'];
  res: GetServerSidePropsContext['res'];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
