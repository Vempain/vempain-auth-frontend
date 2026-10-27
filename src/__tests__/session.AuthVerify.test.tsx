/**
 * @jest-environment jsdom
 */

import {fireEvent, render, screen} from "@testing-library/react";
import {jest} from "@jest/globals";
import {Link, MemoryRouter, Route, Routes} from "react-router-dom";
import {VEMPAIN_LOCAL_STORAGE_KEY} from "../models";
import {AuthVerify} from "../session/AuthVerify";

function App({logOut}: { logOut: () => void }) {
    return (
            <MemoryRouter initialEntries={["/"]}>
                <AuthVerify logOut={logOut}/>
                <Routes>
                    <Route path="/" element={<Link to="/other">go</Link>}/>
                    <Route path="/other" element={<span>other page</span>}/>
                </Routes>
            </MemoryRouter>
    );
}

function store(expiresAt: string) {
    localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({token: "jwt", id: 1, expires_at: expiresAt}));
}

describe("AuthVerify", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("checks a window-only session kept in session storage as well", () => {
        const logOut = jest.fn();
        sessionStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({token: "jwt", id: 1, expires_at: "2099-01-01T00:00:00Z"}));
        const {unmount} = render(<App logOut={logOut}/>);
        expect(logOut).not.toHaveBeenCalled();
        unmount();

        sessionStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, JSON.stringify({token: "jwt", id: 1, expires_at: "2000-01-01T00:00:00Z"}));
        render(<App logOut={logOut}/>);
        expect(logOut).toHaveBeenCalledTimes(1);
    });

    it("does nothing without a stored session", () => {
        const logOut = jest.fn();
        render(<App logOut={logOut}/>);
        expect(logOut).not.toHaveBeenCalled();
    });

    it("keeps a valid session", () => {
        const logOut = jest.fn();
        store("2099-01-01T00:00:00Z");
        render(<App logOut={logOut}/>);
        expect(logOut).not.toHaveBeenCalled();
    });

    it("logs out when the stored session has expired", () => {
        const logOut = jest.fn();
        store("2000-01-01T00:00:00Z");
        render(<App logOut={logOut}/>);
        expect(logOut).toHaveBeenCalledTimes(1);
    });

    it("logs out when the stored session cannot be parsed", () => {
        const logOut = jest.fn();
        localStorage.setItem(VEMPAIN_LOCAL_STORAGE_KEY, "{broken");
        render(<App logOut={logOut}/>);
        expect(logOut).toHaveBeenCalledTimes(1);
    });

    it("re-checks the session on every route change", async () => {
        const logOut = jest.fn();
        store("2099-01-01T00:00:00Z");
        render(<App logOut={logOut}/>);
        expect(logOut).not.toHaveBeenCalled();

        store("2000-01-01T00:00:00Z");
        fireEvent.click(screen.getByText("go"));

        await screen.findByText("other page");
        expect(logOut).toHaveBeenCalledTimes(1);
    });
});
