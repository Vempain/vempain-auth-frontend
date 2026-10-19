/**
 * @jest-environment jsdom
 */

import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import type {LoginResponse} from "../models";
import {VEMPAIN_LOCAL_STORAGE_KEY} from "../models";

type Call = (...args: unknown[]) => Promise<{ status: number; data: unknown }>;

const axiosInstance = {
    defaults: {headers: {common: {} as Record<string, string>, get: {}, post: {}, put: {}, delete: {}}},
    get: jest.fn<Call>(),
    post: jest.fn<Call>(),
    put: jest.fn<Call>(),
    delete: jest.fn<Call>(),
    interceptors: {request: {use: jest.fn(), eject: jest.fn()}, response: {use: jest.fn(), eject: jest.fn()}}
};

jest.mock("axios", () => ({
    __esModule: true,
    default: {create: () => axiosInstance}
}));

const storedSession: LoginResponse = {
    token: "jwt-token",
    id: 7,
    login: "seven",
    nickname: "Seven",
    email: "seven@example.com",
    units: [],
    expires_at: "2099-01-01T00:00:00Z" as never
};

async function modules() {
    const session = await import("../session/SessionProvider");
    const services = await import("../services");
    return {...session, ...services};
}

type SessionModule = Awaited<ReturnType<typeof modules>>;

function Consumer({useSession}: { useSession: SessionModule["useSession"] }) {
    const {userSession, sessionLanguage, getSessionLanguage, setSessionLanguage, loginUser, logoutUser, refreshUserSession} = useSession();
    return (
            <div>
                <span data-testid="login">{userSession?.login ?? "anonymous"}</span>
                <span data-testid="language">{sessionLanguage}/{getSessionLanguage()}</span>
                <button type="button" onClick={() => void loginUser({login: "seven", password: "secret"}).then(status => {
                    document.title = status.status + ":" + status.message;
                })}>login
                </button>
                <button type="button" onClick={() => logoutUser()}>logout</button>
                <button type="button" onClick={() => setSessionLanguage("fi")}>finnish</button>
                <button type="button" onClick={() => refreshUserSession({...storedSession, login: "refreshed"})}>refresh</button>
            </div>
    );
}

describe("SessionProvider", () => {
    let errorSpy: jest.SpiedFunction<typeof console.error>;
    let warnSpy: jest.SpiedFunction<typeof console.warn>;

    beforeEach(() => {
        localStorage.clear();
        document.title = "";
        axiosInstance.post.mockReset();
        axiosInstance.get.mockReset();
        axiosInstance.interceptors.response.use.mockClear();
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it("restores a stored, unexpired session and the stored language", async () => {
        const {SessionProvider, useSession} = await modules();
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(storedSession));
        localStorage.setItem("language", "sv");

        render(<SessionProvider baseURL="http://backend/api"><Consumer useSession={useSession}/></SessionProvider>);

        expect(screen.getByTestId("login").textContent).toBe("seven");
        expect(screen.getByTestId("language").textContent).toBe("sv/sv");
    });

    it("starts anonymous in English without a stored session and drops an expired one", async () => {
        const {SessionProvider, useSession} = await modules();
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({...storedSession, expires_at: "2000-01-01T00:00:00Z"}));

        render(<SessionProvider baseURL="http://backend/api"><Consumer useSession={useSession}/></SessionProvider>);

        expect(screen.getByTestId("login").textContent).toBe("anonymous");
        expect(screen.getByTestId("language").textContent).toBe("en/en");
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("drops a stored session that is not valid JSON", async () => {
        const {getStoredSession} = await modules();
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, "{not json");

        expect(getStoredSession()).toBeNull();
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("logs the user in through AuthAPI, persists the session and reports success", async () => {
        const {SessionProvider, useSession} = await modules();
        axiosInstance.post.mockResolvedValue({status: 200, data: storedSession});

        render(<SessionProvider baseURL="http://backend/api"><Consumer useSession={useSession}/></SessionProvider>);
        fireEvent.click(screen.getByText("login"));

        await waitFor(() => expect(screen.getByTestId("login").textContent).toBe("seven"));
        await waitFor(() => expect(document.title).toBe("SUCCESS:Login successful"));
        expect(axiosInstance.post).toHaveBeenCalledWith("", {login: "seven", password: "secret"});
        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "null")).toEqual(storedSession);
    });

    it("reports a failed login with the error message", async () => {
        const {SessionProvider, useSession} = await modules();
        axiosInstance.post.mockRejectedValueOnce(new Error("Bad credentials")).mockRejectedValueOnce("offline");

        render(<SessionProvider baseURL="http://backend/api"><Consumer useSession={useSession}/></SessionProvider>);
        fireEvent.click(screen.getByText("login"));
        await waitFor(() => expect(document.title).toBe("FAILURE:Failed to log on user: Bad credentials"));

        fireEvent.click(screen.getByText("login"));
        await waitFor(() => expect(document.title).toBe("FAILURE:Failed to log on user: offline"));
        expect(screen.getByTestId("login").textContent).toBe("anonymous");
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("logs out, refreshes the session and persists the language", async () => {
        const {SessionProvider, useSession} = await modules();
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(storedSession));

        render(<SessionProvider baseURL="http://backend/api"><Consumer useSession={useSession}/></SessionProvider>);

        fireEvent.click(screen.getByText("logout"));
        await waitFor(() => expect(screen.getByTestId("login").textContent).toBe("anonymous"));
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();

        fireEvent.click(screen.getByText("refresh"));
        await waitFor(() => expect(screen.getByTestId("login").textContent).toBe("refreshed"));
        expect(JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) ?? "null").login).toBe("refreshed");

        fireEvent.click(screen.getByText("finnish"));
        await waitFor(() => expect(screen.getByTestId("language").textContent).toBe("fi/fi"));
        expect(localStorage.getItem("language")).toBe("fi");
    });

    it("clears the session and redirects to the login path when an API answers 401", async () => {
        const {SessionProvider, useSession, UserAPI, resetUnauthorizedHandling} = await modules();
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify(storedSession));
        resetUnauthorizedHandling();

        const {unmount} = render(
                <SessionProvider baseURL="http://backend/api" loginPath="/signin"><Consumer useSession={useSession}/></SessionProvider>
        );
        expect(screen.getByTestId("login").textContent).toBe("seven");

        // Any AbstractAPI client installs the interceptor; a 401 reaches the callback registered by the provider
        new UserAPI("http://backend/api", "/content-management/users");
        const [, onRejected] = axiosInstance.interceptors.response.use.mock.calls.at(-1) as [unknown, (error: unknown) => Promise<never>];
        await act(async () => {
            await onRejected({response: {status: 401}}).catch(() => undefined);
        });

        await waitFor(() => expect(screen.getByTestId("login").textContent).toBe("anonymous"));
        expect(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY)).toBeNull();
        // jsdom cannot navigate; the attempted redirect is reported through the virtual console
        expect(errorSpy.mock.calls.some(call => String(call[0]).includes("Not implemented: navigation"))).toBe(true);
        expect(console.warn).not.toHaveBeenCalled();

        // After unmounting the provider the interceptor falls back to the configured login path
        unmount();
        resetUnauthorizedHandling();
        await onRejected({response: {status: 401}}).catch(() => undefined);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("No unauthorized callback registered"), "/signin");
    });

    it("useSession throws outside of a provider", async () => {
        const {useSession} = await modules();

        function Orphan() {
            useSession();
            return null;
        }

        expect(() => render(<Orphan/>)).toThrow("useSession must be used within a SessionProvider");
    });
});
