# AGENTS.md

## Snapshot

- This repo is a TypeScript/React library, not a standalone app. The public surface is re-exported from `src/index.ts` into five areas: `main`, `models`,
  `services`, `session`, and `tools`.
- Consumers are expected to compose the exported `Login`, `Logout`, `SessionProvider`, and `AuthVerify` pieces into their own app/router.

## Architecture that matters

- `src/session/SessionProvider.tsx` is the center of auth state. It loads the persisted session from local storage, exposes `useSession()`, and registers the
  unauthorized callback used by API interceptors.
- Session persistence is keyed by `VEMPAIN_LOCAL_STORAGE_KEY` from `src/models/VempainConstants.ts` (`"vempainUser"`). `language` is stored separately under the
  literal key `"language"`.
- `src/services/AbstractAPI.ts` is the base for library consumers’ API wrappers. Every instance creates its own Axios client and calls
  `setupAuthInterceptor(...)` immediately.
- `src/services/AuthInterceptor.ts` is the normal-session expiry mechanism: on `401` or `403`, it clears `vempainUser`, debounces repeated handling for 2
  seconds, then runs the registered callback or falls back to `window.location.href = "/login"`.
- `src/services/AuthAPI.ts` only covers login/logout storage behavior; it does not own global session state.
- `src/session/AuthVerify.tsx` is route-driven expiry checking based on `expires_at` and `useLocation()`. It complements interceptor-based handling but only
  runs inside a router.

## Router and UI assumptions

- `src/main/Login.tsx`, `src/main/Logout.tsx`, and `src/session/AuthVerify.tsx` import hooks from `react-router-dom`; they must render under the consuming app’s
  `<Router>`.
- Do not call router hooks from library-level setup code. Interceptor redirects are intentionally done with `window.location.href` so they still work outside
  React render context.
- Existing component style uses named exports and Ant Design primitives (`Alert`, `Form`, `Spin`, etc.); preserve that style when extending UI pieces.

## Build, test, and release workflow

- Use Yarn 4 (`packageManager: yarn@4.12.0`) with node-modules linking; `.yarnrc.yml` sets `nodeLinker: node-modules`.
- Main local commands from `package.json`:
    - `yarn build` → runs `prebuild` then `tsc -p tsconfig.build.json`
    - `yarn test`, `yarn test:watch`, `yarn test:coverage`
- `generateBuildInfo.js` runs before builds, fetches git tags, reads `VERSION`, and rewrites `src/buildInfo.json`. Treat `src/buildInfo.json` as generated.
- CI in `.github/workflows/ci.yaml` uses Node 22, runs tests + coverage, then builds and publishes to GitHub Packages.

## Conventions visible in source

- Formatting is driven by `.editorconfig`: 4 spaces, LF, max line length 160, spaces inside braces/imports, and typically double-quoted strings in TS/TSX.
- This repo favors named exports (`export {Login}` / `export function SessionProvider`) and barrel files (`src/*/index.ts`). Update barrel exports when adding
  public modules.
- Type-only imports/exports are used consistently, e.g. `import type {LoginRequest}` and `export type {BuildInfo}`.
- Tests live under `src/__tests__/` and use Jest + `ts-jest` in ESM mode; see `src/__tests__/tools-validationTools-test.ts` for the current style.

## Dependency boundaries

- `react`, `react-dom`, `axios`, and `react-router-dom` are peer dependencies for consumers, but they are also present in `devDependencies` so this library can
  build and type-check locally.
- `react-router`/`react-router-dom` versions matter because the library imports hooks directly; keep peer/dev versions aligned when upgrading.
- When changing auth behavior, trace the full flow across `SessionProvider` ↔ `AuthInterceptor` ↔ `AbstractAPI` rather than editing a single file in isolation.

