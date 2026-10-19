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
| `src/management/` | `UserList`, `UserEditor`, `UnitList`, `UnitEditor`, `loadUsersAndUnits` — the user/unit management screens shared by the admin and file SPAs; `AclRowsEditor` (the ACL row editor every Vempain frontend uses) and `AclEditor` (its `AclVO` adapter) |
| `src/models/`     | `Requests/` (`LoginRequest`, `PagedRequest`), `Responses/` (`LoginResponse`, `PagedResponse`, `AclVO`, ...), `*Enum.ts` as `as const` objects             |
| `src/services/`   | `AbstractAPI` (bearer-token Axios client with `findPageable`), `AuthAPI`, `UserAPI`, `UnitAPI`, `AclAPI`, `AuthInterceptor` (401/403 handling)            |
| `src/session/`    | `SessionProvider`, `AuthVerify`, `sessionExpiration`                                                                                                      |
| `src/tools/`      | `AclTool`, `validationTools`, `unitTools` (nested-unit cycle check)                                                                                       |
| `src/__tests__/`  | Jest tests (`*.test.ts(x)`)                                                                                                                               |

## Semantics to preserve

- `SessionProvider` persists `LoginResponse` under the `vempainUser` local-storage key and validates `expires_at` through `isSessionExpired()` before
  restoring a session; `AuthVerify` repeats that check on route changes.
- Every `AbstractAPI` instance installs a request interceptor that sets the W3C `traceparent` header from `src/tools/traceparent.ts`
  (one trace id per page load, generated with Web Crypto, a new span id per request; an explicit `traceparent` of a caller wins).
  Traefik and the backends continue the trace; the website frontend keeps its own copy of the tool (documented exception). Tests
  that mock the Axios instance must provide `interceptors.request.use` as well as `interceptors.response.use`.
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
- `AclRowsEditor` (`src/management/AclRowsEditor.tsx`) is the one ACL row editor of all Vempain frontends: it owns one `Form.List`
  (`fieldName`, `acls` by default) of the host form, takes the grantees as `{value, label}` options (`users`, optional `units`; without
  `units` it is a user-only editor) and knows nothing about requests or APIs. The row field names are configurable (`userField`/`unitField`,
  `user`/`unit` by default, `user_id`/`unit_id` in the publish requests of the file SPA), `hiddenFields` carries ids such as
  `permission_id`/`acl_id` along, `newRow` builds the row of the add button, `uniqueGrantees` offers every grantee in one row only and
  disables the add button when all are used, `rowTestId` names the rows (`acl-row`). Rules, identical everywhere: a row names either a
  user or a unit (a user when there is no unit column), read is required, delete requires modify, switching create on also switches read
  on, and the "All" button left of the switches grants every privilege of its row. Texts use the `AclRow.*` keys with English defaults in
  `ACL_ROW_TRANSLATION_DEFAULTS`. It lives here on purpose: this library is the home of all shared ACL functionality of the Vempain
  frontends (`AclVO`, `PrivilegeEnum`, `AclTool`, `AclAPI`, the ACL rows of the user and unit editors), and `vempain-common-frontend` depends
  on this one (`TaskAPI extends AbstractAPI`), so the dependency can only go this way. Every future shared ACL component, rule, model or
  helper is added here and consumed by the SPAs and the other libraries; never add one to `vempain-common-frontend` or an SPA, and never
  keep a second copy anywhere.
- `AclEditor` (`acls`, `parentForm`, `users: UserVO[]`, `units: UnitVO[]`) is the adapter of `AclRowsEditor` for rows in the persisted
  `AclVO` shape: `userGranteeOptions()`/`unitGranteeOptions()` map the backend's users ("name (nick)") and units to options,
  `permission_id`/`acl_id` ride along hidden and `newAclRow()` starts a new row with read granted. The user and unit editors here and the
  content editors of the admin SPA (page, form, layout, component, gallery through `AclEdit`) mount it; the file SPA's publish dialogs
  mount `AclRowsEditor` directly with `user_id`/`unit_id` rows. `ACL_PRIVILEGES`/`AclPrivilege` are kept as aliases of
  `ACL_ROW_PRIVILEGES`/`AclRowPrivilege`.
- `UserEditor`/`UnitEditor` take `userId`/`unitId` (0 = create), `currentUserId` (a new entity starts with an ACL row granting that user
  everything), `onSaved`, optional `onCancel` and `renderMetadata` (the admin SPA plugs its `MetadataForm` in). Tests:
  `management.AclRowsEditor.test.tsx` (the row rules), `management.AclEditor.test.tsx` (the `AclVO` adapter), `management.UnitEditor.test.tsx`,
  `tools-unitTools.test.ts`, `services-management.test.ts`.

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
