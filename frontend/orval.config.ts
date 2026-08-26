import { defineConfig } from 'orval';

export default defineConfig({
  portfolio: {
    input: { target: 'http://nest-api:3001/backend/docs-json' },
    output: {
      mode: 'single',
      target: './src/api/generated.ts',
      client: 'react-query',
      httpClient: 'fetch',
      clean: false,
      tsconfig: './tsconfig.json',
      formatter: 'prettier',
      override: {
        mutator: { path: './src/api/http-client.ts', name: 'httpClient' },
        enumGenerationType: 'union',
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
