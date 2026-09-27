# Vempain Auth Frontend

`@vempain/vempain-auth-frontend` is a React and TypeScript library for authentication and session handling in Vempain frontends. It provides reusable login
and logout components, session context, session-expiration checks, and Axios-based API helpers.

## Features

- `Login` and `Logout` components for router-based applications
- `SessionProvider` and `useSession()` for login, logout, session refresh, and language preferences
- Automatic removal of invalid or expired persisted sessions
- `AuthVerify` for checking session expiration during route changes
- Axios response handling for `401 Unauthorized` and `403 Forbidden` responses
- `AbstractAPI` helpers for authenticated CRUD requests and pageable queries
- TypeScript models for authentication, paging, sorting, ACL, and API responses

## Requirements

The library expects the consuming application to provide these peer dependencies:

- Node.js 20 or newer for development
- React 19
- React DOM 19
- React Router DOM 7
- Axios 1.20

Ant Design and Day.js are installed as library dependencies. The project uses Yarn 4.18.1.

## Installation

Install the package from the configured Vempain package registry:

```bash
yarn add @vempain/vempain-auth-frontend
```

For local development, clone the repository and install its dependencies:

```bash
git clone https://github.com/Vempain/vempain-auth-frontend.git
cd vempain-auth-frontend
yarn install
```

## Basic usage

The authentication components that use React Router must be rendered inside the consuming application's router. `SessionProvider` receives the authentication
API base URL and optionally the route used when a session expires or an API request is unauthorized.

```tsx
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {AuthVerify, Login, Logout, SessionProvider} from "@vempain/vempain-auth-frontend";

export function App() {
    return (
        <BrowserRouter>
            <SessionProvider baseURL="https://api.example.com" loginPath="/login">
                <AuthVerify logOut={() => window.location.assign("/logout")} />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/logout" element={<Logout />} />
                </Routes>
            </SessionProvider>
        </BrowserRouter>
    );
}
```

Use `useSession()` in application components to access the current session and authentication operations:

```tsx
const {userSession, loginUser, logoutUser, refreshUserSession, sessionLanguage, setSessionLanguage} = useSession();
```

`LoginResponse` values are persisted under the `vempainUser` local-storage key. The selected session language is persisted separately under `language`.

## Session expiration and unauthorized responses

Before restoring a persisted session, `SessionProvider` validates its `expires_at` value through the exported `isSessionExpired()` helper. Missing, invalid, or
past expiration values cause the `vempainUser` entry to be removed and the user to be treated as logged out.

`AuthVerify` performs the same validation when the route changes, which detects a session that expires while the application is open. It should be placed inside
the consuming router and receives a `logOut` callback.

Every `AbstractAPI` instance installs an Axios interceptor. A `401` or `403` response clears the persisted session and invokes the unauthorized callback
registered
by `SessionProvider`. Repeated unauthorized responses are debounced for two seconds. If no callback is registered, the interceptor falls back to redirecting to
`/login`, or to the path configured with `setLoginPath()`.

## Extending `AbstractAPI`

`AbstractAPI` has a public constructor so applications can create typed API services. It automatically adds the bearer token from the current persisted session
to
requests.

```ts
import {AbstractAPI, type PagedRequest, type PagedResponse} from "@vempain/vempain-auth-frontend";

class UserAPI extends AbstractAPI<UserRequest, User> {
    constructor(baseURL: string) {
        super(baseURL, "/users");
    }

    async findUsers(request: PagedRequest): Promise<PagedResponse<User>> {
        return this.findPageable(request);
    }
}
```

`findPageable()` sends a `POST` request to the `paged` endpoint. A `PagedRequest` supports page and size values, optional sorting, search text, and
case-sensitivity; the response includes the page content and pagination metadata.

## Development commands

```bash
yarn build          # Generate build information and compile the package
yarn lint           # Run ESLint
yarn test           # Run the Jest test suite
yarn test:coverage  # Run tests with coverage
```

The package build emits `dist/index.js` and `dist/index.d.ts`. Continuous integration runs through the shared Vempain frontend-library workflow on pull
requests,
pushes to `main`, and version tags.

## Project structure

- `src/main/` - Login and logout components
- `src/models/` - Request, response, paging, sorting, and authentication types
- `src/services/` - `AuthAPI`, `AbstractAPI`, and Axios unauthorized-response handling
- `src/session/` - Session context, route verification, and expiration validation
- `src/tools/` - ACL and validation helpers

## License

GPL-2.0

## Contributing

Pull requests are welcome. For major changes, open an issue before starting implementation.

See [docs/AGENTS.md](docs/AGENTS.md) for repository architecture, conventions, and workflow guidance.
