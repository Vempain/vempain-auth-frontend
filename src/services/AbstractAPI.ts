import Axios, {type AxiosInstance} from "axios";
import {type LoginResponse, type PagedRequest, type PagedResponse, VEMPAIN_LOCAL_STORAGE_KEY} from "../models";
import {setupAuthInterceptor} from "./AuthInterceptor";
import {nextTraceparent} from "../tools/traceparent";

const TRACEPARENT_HEADER = "traceparent";

export abstract class AbstractAPI<REQUEST, RESPONSE> {
    protected axiosInstance: AxiosInstance;

    constructor(baseURL: string, member: string) {
        this.axiosInstance = Axios.create({
            baseURL: baseURL + member
        });

        // Set up the auth interceptor to handle 401 responses
        setupAuthInterceptor(this.axiosInstance);
        // Every request carries the W3C trace context of this page load (one trace id per page, a new span id per request),
        // which Traefik and the backends continue; a caller that set its own traceparent keeps it
        this.axiosInstance.interceptors.request.use(config => {
            const headers = (config.headers ?? {}) as Record<string, unknown> & { set?: (name: string, value: string, rewrite?: boolean) => unknown };

            if (!hasHeader(headers, TRACEPARENT_HEADER)) {
                if (typeof headers.set === "function") {
                    headers.set(TRACEPARENT_HEADER, nextTraceparent(), false);
                } else {
                    headers[TRACEPARENT_HEADER] = nextTraceparent();
                }
                config.headers = headers as typeof config.headers;
            }

            return config;
        });
    }

    public async findAll(params?: Record<string, unknown>): Promise<RESPONSE[]> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.put['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.get<RESPONSE[]>("", {params: params});
        return response.data;
    }

    /**
     * This should be used instead of findAll() when you want to use pagination.
     * @param pagedRequest
     */
    public async findPageable(pagedRequest: PagedRequest): Promise<PagedResponse<RESPONSE>> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.put['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.post<PagedResponse<RESPONSE>>("paged", pagedRequest);
        return response.data;
    }

    public async findById(id: number, parameters: string | null): Promise<RESPONSE> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.put['Content-Type'] = 'application/json;charset=utf-8';
        let url = "/" + id;

        if (parameters !== null) {
            url = parameters ? url + "?" + parameters : url;
        }
        const response = await this.axiosInstance.get<RESPONSE>(url);
        return response.data;
    }

    public async create(payload: REQUEST): Promise<RESPONSE> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.put['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.post<RESPONSE>("", payload);
        return response.data;
    }

    public async update(payload: REQUEST): Promise<RESPONSE> {
        this.setAuthorizationHeader();
        this.axiosInstance.defaults.headers.put['Content-Type'] = 'application/json;charset=utf-8';
        const response = await this.axiosInstance.put<RESPONSE>("", payload);
        return response.data;
    }

    public async delete(id: number): Promise<boolean> {
        this.setAuthorizationHeader();
        const response = await this.axiosInstance.delete<RESPONSE>("/" + id);
        return response.status === 200;
    }

    /**
     * Sets the authorization header for the axios instance. We get the authorization bearer value from the local storage. We're forced
     * to do this on every request because the token can expire at any time.
     * @protected
     */
    protected setAuthorizationHeader(): void {
        const session: LoginResponse = JSON.parse(localStorage.getItem(VEMPAIN_LOCAL_STORAGE_KEY) || "{}");

        if (session && session.token) {
            this.axiosInstance.defaults.headers.common['Authorization'] = 'Bearer ' + session.token;
        }
    }
}

function hasHeader(headers: Record<string, unknown>, name: string): boolean {
    return Object.keys(headers).some(key => key.toLowerCase() === name);
}
