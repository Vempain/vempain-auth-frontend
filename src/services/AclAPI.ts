import {AbstractAPI} from "./AbstractAPI";
import type {AclBulkUpdateRequest, AclBulkUpdateResponse, AclVO} from "../models";

/**
 * The ACL rows of one backend (`<base>/content-management/acls`): the administrator's permissions overview and the bulk update that the
 * list screens use to set the permissions of their selected resources
 */
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

    /**
     * Applies the entries to every ACL of the request (`POST /bulk`): `ADD` merges them into the existing rows, `REPLACE` rewrites the ACL.
     * The backend changes only the ACLs granting the caller the modify privilege and reports the others as skipped.
     */
    public async bulkUpdate(request: AclBulkUpdateRequest): Promise<AclBulkUpdateResponse> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.post['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.post<AclBulkUpdateResponse>("/bulk", request);
        return response.data;
    }
}
