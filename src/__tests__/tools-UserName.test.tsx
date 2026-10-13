/**
 * @jest-environment jsdom
 */

import {render, screen, waitFor} from "@testing-library/react";
import {jest} from "@jest/globals";
import type {UserVO} from "../models";
import type {UserAPI} from "../services/UserAPI";
import {clearUserNameCache, resolveUserName, UserName} from "../tools/UserName";

function api(resolver: (id: number) => Promise<Partial<UserVO>>) {
    return {findById: jest.fn((id: number) => resolver(id))} as unknown as UserAPI;
}

describe("resolveUserName", () => {
    it("formats name and nick, falls back to the nick and then to the id", async () => {
        const userAPI = api(async id => id === 1 ? {name: "Admin", nick: "admin"} : id === 2 ? {name: "", nick: "two"} : {});

        await expect(resolveUserName(userAPI, 1)).resolves.toBe("Admin (admin)");
        await expect(resolveUserName(userAPI, 2)).resolves.toBe("two");
        await expect(resolveUserName(userAPI, 3)).resolves.toBe("#3");
    });

    it("answers with the id when the lookup fails", async () => {
        const userAPI = api(async () => {
            throw new Error("down");
        });

        await expect(resolveUserName(userAPI, 4)).resolves.toBe("#4");
    });

    it("caches the lookups per client until the cache is cleared", async () => {
        const userAPI = api(async () => ({name: "Admin", nick: "admin"}));
        const otherAPI = api(async () => ({name: "Other", nick: "other"}));

        await resolveUserName(userAPI, 1);
        await resolveUserName(userAPI, 1);
        expect(userAPI.findById).toHaveBeenCalledTimes(1);

        await expect(resolveUserName(otherAPI, 1)).resolves.toBe("Other (other)");
        expect(otherAPI.findById).toHaveBeenCalledTimes(1);

        clearUserNameCache(userAPI);
        await resolveUserName(userAPI, 1);
        expect(userAPI.findById).toHaveBeenCalledTimes(2);

        // Clearing a client that never resolved anything is harmless
        clearUserNameCache(api(async () => ({})));
    });
});

describe("UserName", () => {
    it("renders a dash without an id and the id until the name resolves", async () => {
        const userAPI = api(async () => ({name: "Admin", nick: "admin"}));

        const {rerender} = render(<UserName userAPI={userAPI} id={null}/>);
        expect(screen.getByText("–")).toBeTruthy();

        rerender(<UserName userAPI={userAPI} id={0}/>);
        expect(screen.getByText("–")).toBeTruthy();
        expect(userAPI.findById).not.toHaveBeenCalled();

        rerender(<UserName userAPI={userAPI} id={1}/>);
        expect(screen.getByText("#1")).toBeTruthy();
        await screen.findByText("Admin (admin)");
    });

    it("ignores a resolution that completes after unmounting", async () => {
        let resolve: (user: Partial<UserVO>) => void = () => undefined;
        const userAPI = api(() => new Promise<Partial<UserVO>>(r => {
            resolve = r;
        }));

        const {unmount} = render(<UserName userAPI={userAPI} id={5}/>);
        expect(screen.getByText("#5")).toBeTruthy();
        unmount();
        resolve({name: "Late", nick: "late"});

        await waitFor(() => expect(userAPI.findById).toHaveBeenCalledTimes(1));
        await expect(resolveUserName(userAPI, 5)).resolves.toBe("Late (late)");
    });
});
