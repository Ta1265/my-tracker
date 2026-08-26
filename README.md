
# API client type generation with [Orval](https://orval.dev/docs)

The backend serves its OpenAPI document at `/backend/docs-json` and republishes it
automatically on save (`nest start --watch`). Orval reads that URL on the frontend and writes
`frontend/src/api/generated.ts`. The generated types and hooks in this file should be committed.

After changing a backend DTO or controller signature, regenerate the frontend types and hooks.

```sh
docker exec next-app pnpm --filter @portfolio/frontend spec:generate
```
