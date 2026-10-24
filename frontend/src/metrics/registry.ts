import { Registry, collectDefaultMetrics } from 'prom-client';

// Next.js hot-reloads re-evaluate modules in dev, and re-registering a metric throws
// "A metric with that name has already been registered"; globalThis survives that.
const g = globalThis as unknown as {
  metricsRegistry: Registry | undefined;
};

if (!g.metricsRegistry) {
  const registry = new Registry();

  collectDefaultMetrics({ register: registry });

  g.metricsRegistry = registry;
}

export const register = g.metricsRegistry!;
