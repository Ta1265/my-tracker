# Story 14.3a: Coinbase WS feed subscription lifecycle

Status: Done

## Context

Split out of story 14.3 (finding F4) under that story's Acceptance Criteria, which require a
fix that is "more than a small correction" to become its own story rather than be folded into
the sweep's diff. 14.3 found this by driving the live app in a browser; it is not a
post-cutover regression - `frontend/src/context/CoinbaseWsFeedContext.tsx`'s only history in
this repo is `fbcb68f`, the story 1.2 path move - but it is a live defect that intermittently
blanks the page.

`addSubscription` (lines 74-78) queues a subscription for a not-yet-open socket by assigning:

```ts
if (!this.open) {
  ws.onopen = () => ws.send(message);
} else {
  ws.send(message);
}
```

That assignment overwrites the `onopen` handler installed by `connect()` at line 45 - the one
that sets `this.open = true`. Two consequences compound:

- The instance's `open` flag stops tracking the socket. Once a queued subscription has
  replaced the handler, nothing sets `open` to true again, and each later subscription
  overwrites `onopen` in turn, so only the last queued message is ever sent.
- The flag drifts out of sync with the socket's real `readyState`, so the `else` branch can
  call `send()` on a socket that is still CONNECTING.

The second throws `InvalidStateError: Failed to execute 'send' on 'WebSocket': Still in
CONNECTING state`. It is uncaught, so React unwinds to `NotFoundErrorBoundary` and unmounts
the tree - the user sees a blank page. Story 14.3 observed 25 of these in one `/stats` load
alongside 15 `WebSocket is already in CLOSING or CLOSED state` errors. It is a race: a
subsequent navigation to the same route rendered normally.

`connect()` has a related weakness that a fix should not leave behind - its guard at line 25
(`if (this.ws && this.open)`) consults the same unreliable flag, and `onerror` calls
`close()` at line 41 while `onclose` sets `closed = true` at line 35, so a socket that errors
during connect leaves the instance in a state where `closed` is true and `addSubscription`'s
line 63 guard silently returns a no-op unsubscribe for the rest of the page's life. That is
the "CoinbaseWsFeed not initialized" console error 14.3 also observed.

## Acceptance Criteria

- [x] Subscription queueing no longer reassigns `ws.onopen`. Use additive listeners
      (`addEventListener('open', ...)`) or an explicit pending-subscription queue drained by
      the single handler `connect()` installs, so `connect()`'s own bookkeeping always runs.
- [x] The send/queue decision reads the socket's `readyState` rather than the instance's
      `open` flag. If the `open`/`closed`/`error` flags survive at all, they must be derived
      from or kept consistent with `readyState`, not maintained independently of it.
- [x] A subscription requested while the socket is CONNECTING is delivered once the socket
      opens, and multiple subscriptions requested in that window are all delivered - not just
      the last one.
- [x] No `send()` is ever issued on a socket that is not OPEN, and no `InvalidStateError`
      reaches an error boundary. Any error that can still occur is caught at the feed
      boundary so a feed failure degrades the ticker rather than unmounting the page.
- [x] After a socket error or close, a later `addSubscription` either reconnects or returns a
      documented no-op - whichever is chosen, it is deliberate and stated, not the current
      accidental permanent no-op.
- [x] Verify in a browser with the DevTools MCP server the same way story 14.3 did: load
      `/stats` and `/product?unit=BTC&name=Bitcoin` repeatedly (at least five loads each,
      since the failure is a race, not deterministic) and confirm no `InvalidStateError`, no
      blank render, and no `CoinbaseWsFeed not initialized` error. Record the load count.
- [x] Confirm the ticker still updates - a feed that never crashes because it never
      subscribes does not satisfy this story. Show at least one `ticker` message arriving and
      a price updating in the UI.

## Technical Notes

The file is a `'use client'` module exporting an `EventEmitter` subclass plus a React context
provider. The fix belongs in the class; the provider and every call site should be unchanged
unless the class's public surface has to move, in which case say why.

`wss://ws-feed.exchange.coinbase.com` is a third-party origin the browser talks to directly.
That is pre-existing app design (story 14.3 finding F7) and is not in scope to change here.

Story 14.3's Dev Notes hold the captured console output and the reproduction context.

## Out of Scope

- Moving the Coinbase feed server-side, or routing it through the NestJS backend. That is a
  design change, not a defect fix.
- The three known-open observability items named in Epic 14's Scope.
- `frontend/src/components/TopNav.tsx`, the dead pre-seam component story 14.3 found orphaned.
  Unrelated to this defect; raised there for the owner to decide on separately.

## Dev Notes

Implemented 2026-08-28. The fix replaces the hand-maintained `open`/`closed`/`error` flags
with the socket's own `readyState` and makes `unitsSubscribedMap` the single record of what
should be subscribed.

**What changed, and why each part was necessary.**

- `connect()` installs its handlers with `addEventListener` instead of assigning `onopen`,
  `onclose`, `onerror`, `onmessage`. Nothing can now clobber them, which was the root defect.
- The `open` listener subscribes everything currently in `unitsSubscribedMap`. This one change
  covers three acceptance criteria at once: subscriptions requested while CONNECTING are
  delivered (they are in the map by then), *all* of them are delivered rather than only the
  last, and a reconnect restores the previous socket's subscriptions for free.
- `addSubscription` records the product in the map first, then either sends immediately if the
  socket is OPEN or calls `connect()`. `connect()` returns early when a socket is already OPEN
  or CONNECTING, so this is a no-op mid-connect and a genuine reconnect after a close - which
  is the deliberate resolution of the "permanent no-op" the story asked to be decided rather
  than left accidental.
- All sends route through a private `trySend()` that returns early unless `readyState` is
  OPEN and wraps the call in try/catch. No `send()` can reach a CONNECTING socket, and the
  unsubscribe path - which had the same unguarded `ws.send` - is now covered too.
- `handleMessage` guards `JSON.parse`. A malformed frame logs and returns instead of throwing
  out of an event listener.
- `close()` no longer clears `unitsSubscribedMap`. That map is the record the `open` handler
  replays, so clearing it on close would have made every reconnect come back with no
  subscriptions and a silently dead ticker.
- `CoinbaseWsProvider` builds the feed during render via lazy `useRef` init rather than inside
  the effect, so a child that subscribes on its first render finds a feed instead of the
  "CoinbaseWsFeed not initialized" no-op. The constructor opens no socket, so this stays
  SSR-safe; `connect()` still happens in the effect.

The `subscribeMessage(product_id, type)` helper exists because the subscribe and unsubscribe
frames are the same shape and are now built in three places.

**Two things deliberately not done.** The feed still talks to
`wss://ws-feed.exchange.coinbase.com` directly from the browser - out of scope per this
story. And no reconnect backoff was added: `connect()` is only reached from a component
subscribing, not from a retry loop, so there is no path here that can spin.

**Unrelated cleanup in the same file.** `createContext` and `ReactNode` were imported but
unused (pre-existing - the file used `React.createContext` and `React.ReactNode`). Removed,
since the project bans unused imports and the file was already open.

### Verification

```
$ pnpm --filter @portfolio/frontend typecheck
15 errors - identical to the pre-existing baseline, none in this file.

  Note: an intermediate revision of this file dropped the `usePriceFeed` export
  during the rewrite, which surfaced as 6 new TS2305 errors across its consumers
  (TitleAndPriceDisplay, CurrentPrice, DeltaColumn, HoldingsColumn,
  ProfitLossColumn, PriceHistoryProvider). The hook was restored verbatim from
  HEAD and verified byte-identical by diff before this story was marked Done.

$ pnpm --filter @portfolio/frontend lint
0 errors; no warnings in CoinbaseWsFeedContext.tsx (the two unused-import
warnings it previously carried are gone).
```

**Browser verification** (Chrome DevTools MCP, isolated context, signed in as `taylor`,
`next-app` in dev so React Strict Mode's mount/unmount/remount runs on every load - which
exercises the close-then-reconnect path this story rewrote).

Ten loads, five of each route, each instrumented from an `initScript` installed before page
scripts that recorded uncaught errors, unhandled rejections, and any `console.error` matching
`not initialized|InvalidStateError|CLOSING or CLOSED|send failed` into `sessionStorage`:

```
errors: []          <- zero, across all ten loads

loads:  /stats                          len 2174
        /product?unit=BTC&name=Bitcoin  len 6506
        /stats                          len 2174
        /product?unit=BTC&name=Bitcoin  len 6506
        /stats                          len 2176
        /product?unit=BTC&name=Bitcoin  len 6506
        /stats                          len 2174
        /product?unit=BTC&name=Bitcoin  len 6506
        /stats                          len 2174
        /product?unit=BTC&name=Bitcoin  len 6506
```

No blank render (the failure mode being fixed), no `InvalidStateError`, no
`CoinbaseWsFeed not initialized`. Ten loads rather than the five the AC asked for, since the
original failure was a race and not every load lost it.

Ticker still live, via a `WebSocket` wrapper installed before page scripts:

```
subscribe frames sent: 1
  {"type":"subscribe","channels":[{"name":"ticker","product_ids":["BTC-USD"]}]}
ticker messages received: 135 in the first 8s, 397 cumulative
sample: BTC-USD 78512.74 -> 78512.74 -> 78512.75

DOM mutations observed in a 9s window: 506, against 123 ticker messages
in the same window - the UI re-renders off the feed rather than merely
receiving it quietly.
```

Exactly one subscribe frame went out despite Strict Mode's close/reconnect cycle on the same
load, which is the replay path behaving: the subscription survived the reconnect and was not
duplicated.

No fixture data was created. Signed in as the real `taylor` account and did not modify its
data; the feed is read-only.

### Review round 1 fix

Reviewer finding F1, blocking, and correct. The reconnect decision sat inside the
new-product check:

```ts
if (!this.unitsSubscribedMap[product_id]) {
  this.unitsSubscribedMap[product_id] = { lastCalled: null };
  if (this.isOpen) { this.trySend(...) } else { this.connect(); }
}
```

Since the same change deliberately stops `close()` from clearing `unitsSubscribedMap`, every
product still live at the moment of a drop is exactly the set for which `connect()` had become
unreachable. A consumer mounting afterwards for an already-mapped product attached a listener
to a dead feed and never reconnected - a silent frozen ticker, worse than the pre-fix code,
which at least logged. This is a defect the rewrite introduced by pairing two otherwise-good
changes, not one it inherited.

Fixed by hoisting the reconnect out of the new-product check, so the map decides only whether
to *subscribe* and the socket state decides whether to *connect*:

```ts
if (!this.unitsSubscribedMap[product_id]) {
  this.unitsSubscribedMap[product_id] = { lastCalled: null };
  if (this.isOpen) { this.trySend(subscribeMessage(product_id, 'subscribe')); }
}
if (!this.isOpen) { this.connect(); }
```

**Re-verification.** The original browser run could not have caught this, as the reviewer
noted: under Strict Mode the child unsubscribes run before the provider's `close()`, so the
map is empty at remount. Re-verified by forcing the drop by hand instead, with a `WebSocket`
wrapper installed before page scripts recording every socket, frame and ticker message:

```
/stats loaded          sockets 3, last state OPEN, 15 subscribe frames, 332 ticks
force close live ws    states [3,3,3] - all CLOSED, 0 ticks over the next 6s
                       (a further 147 buffered frames landed during CLOSING, then nothing)
client-side nav to /product via the BTC row click:
                       fullReload false   <- provider and dead feed instance survived,
                                             so this is the real reconnect path and not
                                             a fresh page masking it
                       sockets 3 -> 4, new socket state OPEN
                       1 subscribe frame replayed for BTC-USD
                       88 ticker messages after reconnect
```

Frontend typecheck holds at the 15 pre-existing errors, none in this file; lint 0 errors, no
warnings in this file.

**One limit worth stating.** The end-to-end reconnect after a drop is verified above. The
specific already-mapped sub-case resists isolation from outside the app: whichever consumer
subscribes first always takes the not-yet-mapped branch and triggers `connect()`, which masks
the behavior of consumers 2..n on the same product. Attempts to remount a single consumer
while others held the product mapped did not produce one - the stat toggles do not cover the
table's price cells, and sorting reorders with stable keys rather than remounting. That
sub-case therefore rests on the code change and the reviewer's reading of it, not on an
isolated browser repro.

### Changed Files

~ `frontend/src/context/CoinbaseWsFeedContext.tsx`  readyState-driven socket lifecycle; fixes the blank-page crash
