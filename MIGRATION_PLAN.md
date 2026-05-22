# Next.js Pages Router → App Router Migration Plan

## Context

This is a Next.js 14.0.1 portfolio tracker app. It uses:
- **next-auth v4.24.5** with CredentialsProvider (username/password + bcrypt), JWT strategy
- **@tanstack/react-query v5** for all data fetching (no SSR/getServerSideProps anywhere)
- **MUI v5** (@mui/material, @mui/joy, @mui/x-date-pickers)
- **flowbite-react** for UI components
- **Prisma + Redis** on the server side
- **Middleware** protecting `/stats` and `/product/:path*`

All page files are in `src/pages/`. All API route files in `src/pages/api/` are one-liner re-exports from `src/server/api/`. The app directory at `/app/` exists but is empty.

The project root has both a top-level `src/` and an `app/` folder. The Next.js source root is configured via `paths: { "@/*": ["./src/*"] }` in tsconfig. The new app router files should live at `src/app/` so the `@/` alias continues to work.

---

## Constraints & Decisions

1. **Keep next-auth v4** — Do NOT upgrade to v5. Use the App Router compatibility pattern: export `{ GET, POST }` handlers from `app/api/auth/[...nextauth]/route.ts`.
2. **Keep all server logic** in `src/server/api/` untouched. Only the thin route shim files change.
3. **All pages remain fully client-side** — no Server Components needed for page content. Wrap page content files in `'use client'` where they use hooks/context.
4. **MUI SSR fix** — install `@mui/material-nextjs` and wrap root layout with `AppRouterCacheProvider`.
5. **Remove `src/pages/`** only after all routes are verified working in `src/app/`.
6. **`src/pages/api/price-history/check.ts` and `src/pages/api/price-history/set.ts`** are NOT simple re-exports — they contain real logic. Their logic must be moved inline into the new route handler files.

---

## Step-by-Step Instructions

### Step 1: Install MUI App Router package

Run:
```
npm install @mui/material-nextjs @emotion/cache
```

---

### Step 2: Update `tsconfig.json`

The `paths` alias currently points to `./src/*`. Confirm `src/app/` will be picked up by Next.js. Also add `src/app` to the `include` array if needed. No changes are actually required here since Next.js 14 auto-detects `src/app/`.

---

### Step 3: Create `src/app/providers.tsx`

This is a `'use client'` component that wraps all the global context providers previously in `src/pages/_app.tsx`. Fix the `QueryClient` anti-pattern by using `useState`.

**File: `src/app/providers.tsx`**
```tsx
'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ReloadProvider } from '@/context/ReloadContext';
import { SnackbarProvider } from '@/context/SnackBarContext';
import { CoinbaseWsProvider } from '@/context/CoinbaseWsFeedContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: {} },
      }),
  );

  const refetchAllQueries = () => {
    queryClient.refetchQueries();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <SnackbarProvider>
          <ReloadProvider id="reload-provider" onReload={refetchAllQueries}>
            <SessionProvider>
              <CoinbaseWsProvider>{children}</CoinbaseWsProvider>
            </SessionProvider>
          </ReloadProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </QueryClientProvider>
  );
}
```

Note: `SessionProvider` in App Router does NOT accept a `session` prop — remove it.

---

### Step 4: Create `src/app/layout.tsx`

This replaces both `src/pages/_document.tsx` and the wrapping behavior of `src/pages/_app.tsx`.

**File: `src/app/layout.tsx`**
```tsx
import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import Providers from './providers';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
  title: 'Portfolio Tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen">
        <AppRouterCacheProvider>
          <Providers>
            <Layout>{children}</Layout>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
```

---

### Step 5: Create `src/app/page.tsx`

Replaces `src/pages/index.tsx`. The existing page uses `useSession`, `useRouter`, and `signIn` — it must be a client component.

**File: `src/app/page.tsx`**
```tsx
'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'authenticated') {
      router.push('/stats');
    } else {
      signIn('credentials');
    }
  }, [status, router]);

  return <></>;
}
```

Note: `signIn('username')` is not a valid provider id — change to `signIn('credentials')` (the provider `name` field in authOptions is `'Credentials'` but the id is `'credentials'`).

---

### Step 6: Create `src/app/stats/page.tsx`

Replaces `src/pages/stats.tsx`. Uses existing components unchanged. The `Stats.auth = true` pattern (custom auth guard) is replaced by middleware — no special handling needed here.

**File: `src/app/stats/page.tsx`**
```tsx
'use client';

import StatsTable from '@/components/StatsTable';
import SummaryLayout from '@/components/Summary/SummaryLayout';
import React from 'react';
import { StatsTableProvider } from '@/context/StatsTableContext';
import ClientLoader from '@/components/ClientLoader';

export default function Stats() {
  return (
    <ClientLoader>
      <StatsTableProvider>
        <div
          className="flex justify-center py-2"
          style={{ maxWidth: '900px', width: '100%' }}
        >
          <SummaryLayout />
        </div>
        <StatsTable />
      </StatsTableProvider>
    </ClientLoader>
  );
}
```

---

### Step 7: Create `src/app/product/page.tsx`

Replaces `src/pages/product/index.tsx`. The existing page uses `useRouter` from `next/router` to read query params — in App Router, use `useSearchParams` from `next/navigation` instead.

**File: `src/app/product/page.tsx`**
```tsx
'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductTable from '@/components/product/ProductTable';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useReload } from '@/context/ReloadContext';
import { SnackbarContext } from '@/context/SnackBarContext';
import { PriceHistoryProvider } from '@/context/PriceHistoryProvider';
import SingleStat from '@/components/SingleStat';
import Box from '@mui/material/Box';
import { LineChart } from '@/components/product/LineChart';
import { TimeFrameSelect } from '@/components/product/TimeFrameSelect';
import { TitleAndPriceDisplay } from '@/components/product/TitleAndPriceDisplay';

const deleteTransaction = async (id: number) => {
  await fetch(`/api/transaction/${id}`, { method: 'DELETE' })
    .then((resp) => {
      if (resp.status === 204) console.log('success');
    })
    .catch((error) => console.log('error', error));
};

export default function Product() {
  const searchParams = useSearchParams();
  const unit = searchParams.get('unit') as string;
  const productFullName = searchParams.get('name') as string;

  const [deleteTransactionSelection, setDeleteTransactionSelection] = useState<number | null>(null);
  const { triggerReload } = useReload();
  const [confirmModalIsOpen, setConfirmModalIsOpen] = useState(false);
  const snackBarCtx = React.useContext(SnackbarContext);

  if (!unit || !productFullName) {
    return <div></div>;
  }

  return (
    <div className="mx-auto h-full w-full overflow-auto scrollbar scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700">
      <div className="mx-auto h-full w-[99%]" style={{ maxWidth: '910px' }}>
        <PriceHistoryProvider coinName={productFullName} unit={unit}>
          <div className="mx-auto w-full" style={{ maxWidth: '900px' }}>
            <div className="flex py-2">
              <TitleAndPriceDisplay />
              <div className="flex-grow text-center">
                <TimeFrameSelect />
              </div>
            </div>
            <Box
              className="mx-auto flex w-full items-center justify-center"
              style={{ touchAction: 'none', maxHeight: '450px' }}
            >
              <LineChart />
            </Box>
            <br />
            <SingleStat />
          </div>
          <br />
          <ProductTable
            unit={unit}
            setConfirmModalIsOpen={setConfirmModalIsOpen}
            setDeleteTransactionSelection={setDeleteTransactionSelection}
          />
        </PriceHistoryProvider>
        <ConfirmDeleteDialog
          isOpen={confirmModalIsOpen}
          setIsOpen={setConfirmModalIsOpen}
          onConfirm={() => {
            if (deleteTransactionSelection !== null) {
              deleteTransaction(deleteTransactionSelection).then(() => {
                snackBarCtx.toastSuccess({ message: 'Transaction deleted' });
                triggerReload();
              });
            }
          }}
        />
      </div>
    </div>
  );
}
```

---

### Step 8: Create `src/app/api/auth/[...nextauth]/route.ts`

Replaces `src/pages/api/auth/[...nextauth].js`. Uses App Router compatible export pattern for next-auth v4.

**File: `src/app/api/auth/[...nextauth]/route.ts`**
```ts
import NextAuth from 'next-auth';
import { authOptions } from '@/server/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

---

### Step 9: Create all remaining API Route Handlers

For each file below, create the corresponding `src/app/api/.../route.ts`. The server logic in `src/server/api/` stays untouched. These are all simple wrappers that adapt the `NextApiRequest/NextApiResponse` handlers to the App Router `Request/Response` pattern.

**IMPORTANT:** The existing server handlers use `NextApiRequest` and `NextApiResponse`. In App Router, route handlers receive a `Request` object and must return a `Response`. You have two options per route:

**Option A (recommended for simple routes):** Call the handler using a compatibility shim.

Create a shared helper `src/app/api/_nextApiCompat.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest } from 'next/server';

/**
 * Wraps a legacy NextApiHandler so it can be called from an App Router route handler.
 * Returns a Response.
 */
export async function runLegacyHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  nextReq: NextRequest,
  params?: Record<string, string>,
): Promise<Response> {
  let status = 200;
  let body: any = null;
  const headers: Record<string, string> = {};

  const url = new URL(nextReq.url);
  const query: Record<string, string> = params ? { ...params } : {};
  url.searchParams.forEach((v, k) => { query[k] = v; });

  let reqBody: any = undefined;
  const contentType = nextReq.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { reqBody = await nextReq.json(); } catch {}
  }

  const req = {
    method: nextReq.method,
    query,
    body: reqBody,
    headers: Object.fromEntries(nextReq.headers.entries()),
    cookies: Object.fromEntries(
      (nextReq.headers.get('cookie') || '')
        .split(';')
        .filter(Boolean)
        .map((c) => c.trim().split('=').map(decodeURIComponent) as [string, string])
    ),
    // Minimal NextApiRequest compatibility — add more fields if handlers need them
  } as unknown as NextApiRequest;

  const res = {
    status: (s: number) => { status = s; return res; },
    json: (b: any) => { body = b; headers['content-type'] = 'application/json'; return res; },
    send: (b: any) => { body = b; return res; },
    end: (b?: any) => { if (b) body = b; return res; },
    setHeader: (k: string, v: string | string[]) => {
      headers[k] = Array.isArray(v) ? v.join(', ') : v;
      return res;
    },
  } as unknown as NextApiResponse;

  await handler(req, res);

  const responseBody =
    headers['content-type'] === 'application/json'
      ? JSON.stringify(body)
      : body ?? '';

  return new Response(responseBody, { status, headers });
}
```

**NOTE:** `getServerAuthSession` inside the existing handlers uses `req.req` / `req.res` (Pages Router conventions). Since it calls `getServerSession(req, res, authOptions)` from next-auth v4, the compat shim above passes a minimal fake `req` object — **this will NOT work for auth** because next-auth needs the real cookies/headers from the actual request properly attached to the `req` object.

For auth-using routes, you should still use the compat shim but ensure cookies are properly forwarded. The shim above handles `cookie` header forwarding via the `cookies` field and `headers` field, which is sufficient for next-auth v4's JWT strategy (it reads the `next-auth.session-token` cookie).

#### API Route Files to Create

**`src/app/api/exchange-rates/[timeFrame]/[coinName]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/exchange-rates/history';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { timeFrame: string; coinName: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/exchange-rates/unit/[unit]/route.ts`**
```ts
import { runLegacyHandler } from '../../../_nextApiCompat';
import handler from '@/server/api/exchange-rates/by-unit';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { unit: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/price-history/check/route.ts`**

This file has inline logic (not a re-export). Move the logic directly:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { type TimeFrame } from '@/types/global'; // adjust import if needed
import redisClient from '@/server/redisClient';
import db from '@/server/db/dbService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { cookies } from 'next/headers';

const timeFrames: TimeFrame[] = ['h', 'd', 'w', 'm', '3m', '6m', 'y', 'all'];

export async function GET(req: NextRequest) {
  // next-auth v4 getServerSession in App Router requires passing the full request
  // Use the headers-based approach
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as number;

  const coins = await db.getUsersCoins(userId);
  const cachesNeedingUpdate: { coinName: string; timeFramesNeeded: TimeFrame[] }[] = [];

  await Promise.all(
    coins.map(async ({ coinName }) => {
      const coin = { coinName, timeFramesNeeded: [] as TimeFrame[] };
      await Promise.all(
        timeFrames.map(async (timeFrame) => {
          const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;
          const cacheValue = await redisClient.exists(cacheKey);
          if (!cacheValue) coin.timeFramesNeeded.push(timeFrame);
        }),
      );
      cachesNeedingUpdate.push(coin);
    }),
  );

  return NextResponse.json(cachesNeedingUpdate);
}
```

**`src/app/api/price-history/set/route.ts`**

This file also has inline logic:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { type TimeFrame, type PriceHistoryResp } from '@/types/global';
import redisClient from '@/server/redisClient';

const minute = 60, hour = 60 * minute, day = hour * 24;
const cacheExpirationForTimeFrame: Record<TimeFrame, number> = {
  h: 10 * minute, d: 1 * hour, w: 1 * day, m: 1 * day,
  '3m': 1 * day, '6m': 1 * day, y: 1 * day, all: 1 * day,
};

export async function POST(req: NextRequest) {
  const { timeFrame, priceHistoryResp, coinName } = await req.json() as {
    coinName: string; timeFrame: TimeFrame; priceHistoryResp: PriceHistoryResp;
  };

  if (!timeFrame || !priceHistoryResp || !coinName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const cacheKey = `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}`;
  await redisClient.setex(cacheKey, cacheExpirationForTimeFrame[timeFrame], JSON.stringify(priceHistoryResp));

  return NextResponse.json({ message: `Price history cached successfully: ${coinName} - ${timeFrame}` });
}
```

**`src/app/api/product/[product]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/product/by-name';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { product: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/stats/[unit]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/stats/by-unit';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { unit: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/summary/[unit]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/summary/coins';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { unit: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/summary/coins/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/summary/coins';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return runLegacyHandler(handler, req);
}
```

**`src/app/api/summary/portfolio/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/summary/portfolio';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return runLegacyHandler(handler, req);
}
```

**`src/app/api/summary/profitLossChart/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/summary/profitLossChart';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  return runLegacyHandler(handler, req);
}
```

**`src/app/api/summary/profitLossChart/[timeFrame]/route.ts`**
```ts
import { runLegacyHandler } from '../../../_nextApiCompat';
import handler from '@/server/api/summary/profitLossChart';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { timeFrame: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/time-frame-coins-pl/[timeFrame]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/exchange-rates/time-frame-coins-pl';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { timeFrame: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/time-frame-total-pl/[timeFrame]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/exchange-rates/time-frame-total-pl';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { timeFrame: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/token-info/[userId]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/token-info/update-price-history';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/token-info/search/[searchTerm]/route.ts`**
```ts
import { runLegacyHandler } from '../../../_nextApiCompat';
import handler from '@/server/api/token-info/search';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { searchTerm: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/transaction/[id]/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/transaction';
import { NextRequest } from 'next/server';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return runLegacyHandler(handler, req, params);
}
```

**`src/app/api/transaction/add/route.ts`**
```ts
import { runLegacyHandler } from '../../_nextApiCompat';
import handler from '@/server/api/transaction/add';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  return runLegacyHandler(handler, req);
}
```

---

### Step 10: Update `src/middleware.ts`

The existing middleware exports the default next-auth middleware which works fine in App Router. No changes needed. Verify it still reads:

```ts
export { default } from 'next-auth/middleware';
export const config = { matcher: ['/stats', '/product/:path*'] };
```

---

### Step 11: Update `src/server/auth.ts`

Remove the `getServerAuthSession` function that takes `(ctx: { req, res })` since it won't be used anymore. Add a new server-side helper using `getServerSession` without req/res (App Router style):

At the bottom of `src/server/auth.ts`, replace the existing `getServerAuthSession` export with:
```ts
// App Router compatible — no req/res needed, reads cookies from Next.js headers
export const getServerAuthSession = () => getServerSession(authOptions);
```

Remove the old `GetServerSidePropsContext` import from `next` at the top since it's no longer used.

**IMPORTANT:** Also remove the import of `type { GetServerSidePropsContext } from 'next'` at the top.

---

### Step 12: Update `src/components/TopNav.tsx`

`TopNav` uses `next-auth/react` which is fine, but if it uses `next/router` anywhere, update to `next/navigation`. Currently it does not use router — no changes needed.

**However**, `TopNav` and `Layout` are used inside `RootLayout` (a Server Component). Since they use `useSession` and `useState`, they must be marked `'use client'`.

Add `'use client';` as the first line of:
- `src/components/TopNav.tsx`
- `src/components/Layout.tsx`

---

### Step 13: Mark other client components

Any component that uses React hooks, context, or browser APIs must be marked `'use client'`. Go through these files and add `'use client'` as the first line if not already present:

- `src/components/AddTransaction.tsx`
- `src/components/AnimatingNumber.tsx`
- `src/components/ClientLoader.tsx`
- `src/components/ConfirmDeleteDialog.tsx`
- `src/components/ModalContextProvider.tsx`
- `src/components/NumberFormatCustom.tsx`
- `src/components/SingleStat.tsx`
- `src/components/SortArrow.tsx`
- `src/components/StatsTable.tsx`
- `src/components/TableComponent.tsx`
- `src/components/TickerDisplay.tsx`
- `src/components/product/LineChart.tsx`
- `src/components/product/ProductTable.tsx`
- `src/components/product/TimeFrameSelect.tsx`
- `src/components/product/TitleAndPriceDisplay.tsx`
- `src/components/product/TransactionProfitLossColumn.tsx`
- `src/components/stats-table/CoinColumn.tsx`
- `src/components/stats-table/CostBasisColumn.tsx`
- `src/components/stats-table/CurrentPrice.tsx`
- `src/components/stats-table/DeltaColumn.tsx`
- `src/components/stats-table/HoldingsColumn.tsx`
- `src/components/stats-table/ProfitLossColumn.tsx`
- `src/components/stats-table/StatsTableComponent.tsx`
- `src/components/Summary/SummaryContext.tsx`
- `src/components/Summary/SummaryLayout.tsx`
- `src/components/Summary/TotalsSummary.tsx`
- `src/components/Summary/Breakdown/` (all files)
- `src/components/Summary/TotalChart/` (all files)
- All files in `src/context/`
- All files in `src/_hooks/`

Check each file for `useState`, `useEffect`, `useContext`, `useRef`, event handlers, or browser APIs. Add `'use client'` if any are present.

---

### Step 14: Delete `src/pages/`

After verifying the app runs correctly with `npm run dev`, delete the entire `src/pages/` directory:

```
rm -rf src/pages
```

---

### Step 15: Verify build

Run:
```
npm run build
```

Fix any TypeScript or import errors. Since `typescript.ignoreBuildErrors: true` is set in `next.config.js`, the build may succeed even with errors — check the terminal output for warnings.

---

## Known Gotchas

### 1. `getServerAuthSession` in legacy handlers
The existing server handlers call `getServerAuthSession({ req, res })`. After Step 11, the signature changes to `getServerAuthSession()`. You must update every call in `src/server/api/**/*.ts` to remove the `{ req, res }` argument.

Files to update:
- `src/server/api/exchange-rates/time-frame-coins-pl.ts`
- `src/server/api/exchange-rates/time-frame-total-pl.ts`
- `src/server/api/product/by-name.ts`
- `src/server/api/stats/by-unit.ts`
- `src/server/api/summary/coins.ts`
- `src/server/api/summary/portfolio.ts`
- `src/server/api/summary/profitLossChart.ts`
- `src/server/api/transaction/index.ts`
- `src/server/api/transaction/add.ts`

In each file, change:
```ts
const session = await getServerAuthSession({ req, res });
```
to:
```ts
const session = await getServerAuthSession();
```

**BUT**: `getServerSession()` without req/res works in Server Components and Route Handlers in App Router because it reads from Next.js's internal headers store. When called via the `runLegacyHandler` compat shim (which runs inside a Route Handler), it WILL have access to the headers store, so this will work correctly.

### 2. `signIn('username')` on index page
The original `src/pages/index.tsx` calls `signIn('username')`. The correct provider ID for `CredentialsProvider` is `'credentials'` (lowercased name). Change to `signIn('credentials')`.

### 3. `router.isReady` on product page
The original product page checks `router.isReady` before reading query params. With `useSearchParams()` in App Router, params are always available synchronously — remove that check.

### 4. `useRouter` from `next/router`
Search all component files for `from 'next/router'` and replace with `from 'next/navigation'`. The APIs differ:
- `router.push(url)` → same in next/navigation
- `router.query.foo` → `useSearchParams().get('foo')`
- `router.pathname` → `usePathname()`
- `router.isReady` → remove (not needed)

### 5. MUI Emotion SSR
Without `AppRouterCacheProvider`, MUI styles may flash or not apply correctly in App Router. The `AppRouterCacheProvider` from `@mui/material-nextjs` handles this. It's added in Step 4 (root layout).

### 6. `src/app` vs top-level `app/`
The project has a top-level `app/` folder (currently empty). Next.js 14 supports both `app/` and `src/app/` but will prefer `src/app/` if `src/pages/` exists alongside. Since pages is being removed, place all new files in `src/app/` to match the `@/*` alias pointing to `src/`. Do NOT use the top-level `app/` folder.

### 7. `next-auth` session cookie in compat shim
The `runLegacyHandler` compat shim must forward the `cookie` header from the incoming `NextRequest` to the fake `req` object so next-auth can read the JWT cookie. The shim above handles this via the `headers` field and `cookies` field on the fake req object. Verify next-auth v4's `getServerSession` reads from `req.headers.cookie` — it does when using JWT strategy.

---

## File Structure After Migration

```
src/
  app/
    layout.tsx                          # Root layout (replaces _document + _app wrapper)
    page.tsx                            # / route (replaces pages/index.tsx)
    providers.tsx                       # Client providers wrapper
    stats/
      page.tsx                          # /stats route
    product/
      page.tsx                          # /product route
    api/
      _nextApiCompat.ts                 # Shared compat shim
      auth/
        [...nextauth]/
          route.ts
      exchange-rates/
        [timeFrame]/
          [coinName]/
            route.ts
        unit/
          [unit]/
            route.ts
      price-history/
        check/
          route.ts
        set/
          route.ts
      product/
        [product]/
          route.ts
      stats/
        [unit]/
          route.ts
      summary/
        [unit]/
          route.ts
        coins/
          route.ts
        portfolio/
          route.ts
        profitLossChart/
          route.ts
          [timeFrame]/
            route.ts
      time-frame-coins-pl/
        [timeFrame]/
          route.ts
      time-frame-total-pl/
        [timeFrame]/
          route.ts
      token-info/
        [userId]/
          route.ts
        search/
          [searchTerm]/
            route.ts
      transaction/
        [id]/
          route.ts
        add/
          route.ts
  components/     # unchanged, add 'use client' where needed
  context/        # unchanged, add 'use client' to all files
  _hooks/         # unchanged, add 'use client' to all files
  server/         # unchanged except auth.ts and getServerAuthSession calls
  styles/         # unchanged
  middleware.ts   # unchanged
```
