---
name: change-public-api
description: Change an export of the vempain-auth-frontend library (session, AbstractAPI, VempainTable, usePagedTable, models) and roll it into the consuming SPAs with a version bump. Use whenever src/index.ts or a re-exported module changes.
---

# Change the public API of vempain-auth-frontend

- The published surface is everything re-exported from `src/index.ts` (`main`, `models`, `services`, `session`, `tools`). Consumers:
  `vempain-admin-frontend`, `vempain-file-frontend` (full), `vempain-website-frontend` (types only), `vempain-common-frontend`
  (`AbstractAPI`). Any export change is breaking for them: bump `VERSION`, and update the consumers in the same change set.
- Semantics to preserve: `SessionProvider` stores `LoginResponse` under `vempainUser` and checks `expires_at`; every `AbstractAPI` installs
  the 401/403 interceptor (session cleared, debounced redirect to `/login` or `setLoginPath()`); `findPageable()` posts a `PagedRequest`
  to `<base>/paged`; JSON is snake_case (`sort_by`, `total_pages`, `total_elements`, `filter_column`).
- `usePagedTable`/`VempainTable`: server mode accepts one column filter (`filter_column`) per request; keep `setFilter`, `reload`, `deps`
  and the mobile column collapse behaviour, the SPAs build on them.
- Peer dependencies (React 19, React Router 7, Axios 1.x) stay peers; Ant Design and Day.js are library dependencies.
- No TypeScript `enum`; `as const` objects (`PrivilegeEnum`, `SortDirectionEnum`, `ActionResultEnum`).
- Tests in `src/__tests__/` (node environment by default, `@jest-environment jsdom` docblock plus `matchMedia`/`MessageChannel`/
  `ResizeObserver` stubs for components). Run `yarn lint`, `yarn test`, `yarn build`; only `dist/` is published (`frontend-library.yaml` sets the version from
  `VERSION` and publishes on `main`).
