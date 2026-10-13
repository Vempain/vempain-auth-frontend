/**
 * @jest-environment jsdom
 */

import {render, screen} from "@testing-library/react";
import {jest} from "@jest/globals";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {Logout} from "../main/Logout";

const logoutUser = jest.fn();

jest.mock("../session", () => ({
    useSession: () => ({logoutUser})
}));

describe("Logout", () => {
    it("clears the session and navigates to the front page", async () => {
        render(
                <MemoryRouter initialEntries={["/logout"]}>
                    <Routes>
                        <Route path="/logout" element={<Logout/>}/>
                        <Route path="/" element={<span>front page</span>}/>
                    </Routes>
                </MemoryRouter>
        );

        await screen.findByText("front page");
        expect(logoutUser).toHaveBeenCalledTimes(1);
    });
});
