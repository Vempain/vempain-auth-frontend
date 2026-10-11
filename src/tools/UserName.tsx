import {Typography} from "antd";
import {useEffect, useState} from "react";
import type {UserAPI} from "../services/UserAPI";

const userNameCaches = new WeakMap<UserAPI, Map<number, Promise<string>>>();

export function resolveUserName(userAPI: UserAPI, id: number): Promise<string> {
    let cache = userNameCaches.get(userAPI);
    if (cache === undefined) {
        cache = new Map();
        userNameCaches.set(userAPI, cache);
    }

    let pending = cache.get(id);
    if (pending === undefined) {
        pending = userAPI.findById(id, null)
                .then(user => user?.name ? `${user.name} (${user.nick})` : user?.nick ?? `#${id}`)
                .catch(() => `#${id}`);
        cache.set(id, pending);
    }
    return pending;
}

export function clearUserNameCache(userAPI: UserAPI): void {
    userNameCaches.get(userAPI)?.clear();
}

export function UserName({userAPI, id}: { userAPI: UserAPI; id: number | null | undefined }) {
    const [name, setName] = useState<string | null>(null);

    useEffect(() => {
        if (id === null || id === undefined || id <= 0) {
            return;
        }
        let active = true;
        resolveUserName(userAPI, id).then(resolved => {
            if (active) setName(resolved);
        });
        return () => {
            active = false;
        };
    }, [userAPI, id]);

    if (id === null || id === undefined || id <= 0) {
        return <Typography.Text type="secondary">–</Typography.Text>;
    }
    return <Typography.Text>{name ?? `#${id}`}</Typography.Text>;
}
