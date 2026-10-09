/**
 * @jest-environment jsdom
 */

import {jest} from "@jest/globals";
import type {UnitVO, UserVO} from "../models";

const axiosInstance = {
    defaults: {headers: {common: {}, get: {}, post: {}, put: {}, delete: {}}},
    get: jest.fn<(...args: unknown[]) => Promise<{ data: unknown }>>(),
    post: jest.fn<(...args: unknown[]) => Promise<{ data: unknown }>>(),
    put: jest.fn<(...args: unknown[]) => Promise<{ data: unknown }>>(),
    delete: jest.fn<(...args: unknown[]) => Promise<{ data: unknown }>>(),
    interceptors: {response: {use: jest.fn(), eject: jest.fn()}}
};

jest.mock("axios", () => ({
    __esModule: true,
    default: {create: () => axiosInstance}
}));

describe("management API clients", () => {
    beforeEach(() => {
        axiosInstance.put.mockReset();
        axiosInstance.get.mockReset();
    });

    it("UserAPI.update puts to /{id} as the backend requires", async () => {
        const {UserAPI} = await import("../services/UserAPI");
        const userAPI = new UserAPI("http://backend/api", "/content-management/users");
        const user = {id: 7, login_name: "seven", unit_ids: [2]} as UserVO;
        axiosInstance.put.mockResolvedValue({data: user});

        const result = await userAPI.update(user);

        expect(axiosInstance.put).toHaveBeenCalledWith("/7", user);
        expect(result).toEqual(user);
    });

    it("UnitAPI.update puts to /{id} with the member lists", async () => {
        const {UnitAPI} = await import("../services/UnitAPI");
        const unitAPI = new UnitAPI("http://backend/api", "/content-management/units");
        const unit = {id: 3, name: "unit", user_ids: [7], unit_ids: [4]} as UnitVO;
        axiosInstance.put.mockResolvedValue({data: unit});

        const result = await unitAPI.update(unit);

        expect(axiosInstance.put).toHaveBeenCalledWith("/3", unit);
        expect(result.unit_ids).toEqual([4]);
    });

    it("AclAPI lists all rows and the rows of one acl id", async () => {
        const {AclAPI} = await import("../services/AclAPI");
        const aclAPI = new AclAPI("http://backend/api", "/content-management/acls");
        axiosInstance.get.mockResolvedValueOnce({data: [{acl_id: 1}]}).mockResolvedValueOnce({data: [{acl_id: 9}]});

        expect(await aclAPI.getAll()).toEqual([{acl_id: 1}]);
        expect(await aclAPI.getByAclId(9)).toEqual([{acl_id: 9}]);
        expect(axiosInstance.get).toHaveBeenLastCalledWith("/9");
    });
});
