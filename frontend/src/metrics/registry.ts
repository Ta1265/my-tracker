import { Registry, collectDefaultMetrics } from 'prom-client';

// globalThis guard: Next.js hot-reloads re-evaluate modules in dev mode — without this
// guard each reload would attempt to re-register metrics and throw "A metric with that
// name has already been registered". Storing on globalThis survives module re-evaluation.
const g = globalThis as unknown as {
  metricsRegistry: Registry | undefined;
};

if (!g.metricsRegistry) {
  const registry = new Registry();

  collectDefaultMetrics({ register: registry });

  g.metricsRegistry = registry;
}

export const register = g.metricsRegistry!;
