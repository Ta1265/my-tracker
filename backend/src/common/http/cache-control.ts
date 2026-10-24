// `private` is load-bearing: these responses are per-user, so a shared cache must never
// hand one caller's portfolio to another. 15s matches the exchange-rate refresh window,
// past which the server would recompute a different answer anyway.
export const PORTFOLIO_CACHE_CONTROL = 'private, max-age=15';
