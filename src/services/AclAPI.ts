import {AbstractAPI} from "./AbstractAPI";
import type {AclVO} from "../models";

/** Read-only ACL rows of one backend (`<base>/content-management/acls`), for the permissions overview */
export class AclAPI extends AbstractAPI<never, AclVO> {
    public getAll(): Promise<AclVO[]> {
        return this.findAll();
    }

    /** The rows sharing one acl_id */
    public async getByAclId(aclId: number): Promise<AclVO[]> {
        this.setAuthorizationHeader();
        const response = await this.axiosInstance.get<AclVO[]>("/" + aclId);
        return response.data;
    }
}
