# vempain-auth-frontend — Agent Guide

## What this repo is

- `@vempain/vempain-auth-frontend` is a **React/TypeScript library** (ESM, published to GitHub Packages), not an app. It provides the login/logout
  components, `SessionProvider`/`useSession()`, `AuthVerify`, the Axios `AbstractAPI` base class and the shared paging/ACL models used by
  `vempain-admin-frontend`, `vempain-file-frontend` and (for types) `vempain-website-frontend`.
- The published API surface is everything re-exported from `src/index.ts` (`main`, `models`, `services`, `session`, `tools`). Changing an export is a
  breaking change for the consuming SPAs; bump the version and update the consumers in the same change set.

## Layout

| Path              | Purpose                                                                                                                                                   |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/main/`       | `Login`, `Logout`, `VempainTable`, `usePagedTable`                                                                                                        |
| `src/management/` | `UserList`, `UserEditor`, `UnitList`, `UnitEditor`, `AclEditor`, `loadUsersAndUnits` — the user/unit management screens shared by the admin and file SPAs |
| `src/models/`     | `Requests/` (`LoginRequest`, `PagedRequest`), `Responses/` (`LoginResponse`, `PagedResponse`, `AclVO`, ...), `*Enum.ts` as `as const` objects             |
| `src/services/`   | `AbstractAPI` (bearer-token Axios client with `findPageable`), `AuthAPI`, `UserAPI`, `UnitAPI`, `AclAPI`, `AuthInterceptor` (401/403 handling)            |
| `src/session/`    | `SessionProvider`, `AuthVerify`, `sessionExpiration`                                                                                                      |
| `src/tools/`      | `AclTool`, `validationTools`, `unitTools` (nested-unit cycle check)                                                                                       |
| `src/__tests__/`  | Jest tests (`*.test.ts(x)`)                                                                                                                               |

## Semantics to preserve

- `SessionProvider` persists `LoginResponse` under the `vempainUser` local-storage key and validates `expires_at` through `isSessionExpired()` before
  restoring a session; `AuthVerify` repeats that check on route changes.
- Every `AbstractAPI` instance installs the unauthorized interceptor: a `401`/`403` clears the session and calls the callback registered by
  `SessionProvider` (debounced two seconds), falling back to `/login` or `setLoginPath()`.
- `findPageable()` posts a `PagedRequest` to `<base>/paged`; all JSON is snake_case (`sort_by`, `total_pages`, `total_elements`, ...).
- Peer dependencies (React 19, React Router 7, Axios 1.x) are provided by the host; Ant Design and Day.js are library dependencies.

## User and unit management

- The admin and file backends keep separate user bases, but both host the same endpoints from `vempain-auth-core`
  (`/content-management/users|units|acls`, administrator ACL required). Each SPA therefore instantiates `UserAPI`, `UnitAPI` and
  `AclAPI` against its own backend URL and mounts the screens of `src/management/` with those instances; the screens never know a
  backend. `UserAPI.update`/`UnitAPI.update` send `PUT /{id}` (the generic `AbstractAPI.update` would hit the collection path).
- Units nest: `UnitVO.unit_ids` are the direct sub-units and `UnitVO.user_ids` the direct member users; `UserVO.unit_ids` the units a
  user is a direct member of. `UnitEditor` offers as member units only `selectableMemberUnits()` (never the unit itself nor a unit
  containing it) and `wouldCreateUnitCycle()` rejects a circular choice on submit; the backend repeats the check and answers 400.
- `AclEditor` (`acls` Form.List of the host form, `users`/`units` passed in) carries the shared rules: either a user or a unit per row,
  read required, delete requires modify, create implies read, and the "All" button left of the switches grants every privilege of its
  row. The host editors (page, form, layout, component, gallery, user, unit) reuse it instead of local copies.
- `UserEditor`/`UnitEditor` take `userId`/`unitId` (0 = create), `currentUserId` (a new entity starts with an ACL row granting that user
  everything), `onSaved`, optional `onCancel` and `renderMetadata` (the admin SPA plugs its `MetadataForm` in). Tests:
  `management.AclEditor.test.tsx`, `management.UnitEditor.test.tsx`, `tools-unitTools.test.ts`, `services-management.test.ts`.

## Conventions

- Do not add TypeScript `enum`; use `as const` objects (`PrivilegeEnum`, `SortDirectionEnum`, `ActionResultEnum`).
- Tests live in `src/__tests__/`; Jest runs with `ts-jest` under the `node` environment (`jest.config.js`, `tsconfig.jest.json`); component
  tests opt into jsdom with a `@jest-environment jsdom` docblock and stub `matchMedia`, `MessageChannel` and `ResizeObserver` for antd.
- `tsconfig.build.json` excludes tests and emits `dist/` with declarations; only `dist/` is published.
- Build metadata is generated by `generateBuildInfo.js` into `src/buildInfo.json`; treat the JSON as a derived artifact.

## Tooling and validation

```bash
yarn lint
yarn test
yarn build
```

Use the checked-in Yarn 4 release. CI uses the reusable `frontend-library.yaml` workflow from `vempain-workflows`, which sets the package version from
`VERSION` and publishes to GitHub Packages on `main`. Do not commit `dist/`, `coverage/` or `node_modules/`.

## Tag ACL rule

Tags are metadata, not ACL-bearing resources. Tag entities have no ACL information, so tag list, search, and mutation endpoints must not perform ACL checks on
tags. ACL checks apply only to resources that explicitly carry an ACL.
