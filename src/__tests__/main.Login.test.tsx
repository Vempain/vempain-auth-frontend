/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import type {LoginRequest, LoginStatus} from "../models";
import {ActionResultEnum} from "../models";
import {Login} from "../main/Login";

const loginUser = jest.fn<(request: LoginRequest) => Promise<LoginStatus>>();

jest.mock("../session", () => ({
    useSession: () => ({loginUser})
}));

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
        matches: false,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined
    })
});
if (typeof globalThis.MessageChannel === "undefined") {
    class StubMessageChannel {
        port1: { onmessage: ((event: { data: unknown }) => void) | null; postMessage: (data: unknown) => void };
        port2: { onmessage: ((event: { data: unknown }) => void) | null; postMessage: (data: unknown) => void };

        constructor() {
            this.port1 = {onmessage: null, postMessage: data => setTimeout(() => this.port2.onmessage?.({data}), 0)};
            this.port2 = {onmessage: null, postMessage: data => setTimeout(() => this.port1.onmessage?.({data}), 0)};
        }
    }

    Object.defineProperty(globalThis, "MessageChannel", {writable: true, value: StubMessageChannel});
}

function App() {
    return (
            <MemoryRouter initialEntries={["/login"]}>
                <Routes>
                    <Route path="/login" element={<Login/>}/>
                    <Route path="/" element={<span>front page</span>}/>
                </Routes>
            </MemoryRouter>
    );
}

async function fillAndSubmit(username: string, password: string) {
    fireEvent.change(screen.getByLabelText("Username"), {target: {value: username}});
    fireEvent.change(screen.getByLabelText("Password"), {target: {value: password}});
    fireEvent.click(screen.getByText("Submit"));
}

describe("Login", () => {
    beforeEach(() => {
        loginUser.mockReset();
    });

    it("sends the credentials to the session and navigates to the front page on success", async () => {
        loginUser.mockResolvedValue({status: ActionResultEnum.SUCCESS, message: "Login successful"});
        render(<App/>);

        await fillAndSubmit("seven", "secret");

        await screen.findByText("front page");
        expect(loginUser).toHaveBeenCalledWith({login: "seven", password: "secret"});
    });

    it("shows the failure and returns to the front page on request", async () => {
        loginUser.mockResolvedValue({status: ActionResultEnum.FAILURE, message: "Failed to log on user: nope"});
        render(<App/>);

        await fillAndSubmit("seven", "wrong");

        await screen.findByText("Failed to log in user");
        expect(screen.queryByText("front page")).toBeNull();

        fireEvent.click(screen.getByText("Return to front page"));
        await screen.findByText("front page");
    });

    it("treats a missing login status as a failure", async () => {
        loginUser.mockResolvedValue(undefined as never);
        render(<App/>);

        await fillAndSubmit("seven", "secret");

        await screen.findByText("Failed to log in user");
    });

    it("does not log in with empty fields and logs the validation failure", async () => {
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
        render(<App/>);

        fireEvent.click(screen.getByText("Submit"));

        await screen.findByText("Please input your username!");
        await waitFor(() => expect(logSpy).toHaveBeenCalledWith("Failed:", expect.objectContaining({errorFields: expect.any(Array)})));
        expect(loginUser).not.toHaveBeenCalled();
        logSpy.mockRestore();
    });
});
