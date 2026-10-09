import {Button, Space, Spin} from "antd";
import {EditOutlined, PlusCircleFilled} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import {usePagedTable} from "../main/usePagedTable";
import {type VempainColumnsType, VempainTable} from "../main/VempainTable";
import type {UserVO} from "../models";
import type {UserAPI} from "../services/UserAPI";

export interface UserListProps {
    userAPI: UserAPI;
    /** Called with the id of the user to edit */
    onEdit: (userId: number) => void;
    /** Called when a new user should be created */
    onCreate: () => void;
}

/**
 * Server-paged list of the user accounts of one backend with edit and create actions; the host decides where editing happens.
 */
export function UserList({userAPI, onEdit, onCreate}: UserListProps) {
    const {t} = useTranslation();
    const paged = usePagedTable<UserVO>(request => userAPI.findPageable(request), {defaultPageSize: 10, defaultSortBy: "name"});

    const columns: VempainColumnsType<UserVO> = [
        {title: t("UserList.columns.id", {defaultValue: "ID"}), dataIndex: "id", key: "id", sorter: true},
        {title: t("UserList.columns.loginName", {defaultValue: "Login name"}), dataIndex: "login_name", key: "login_name", mobile: true},
        {title: t("UserList.columns.name", {defaultValue: "Name"}), dataIndex: "name", key: "name", sorter: true, mobile: true},
        {title: t("UserList.columns.nick", {defaultValue: "Nick"}), dataIndex: "nick", key: "nick"},
        {title: t("UserList.columns.email", {defaultValue: "Email"}), dataIndex: "email", key: "email"},
        {
            title: t("UserList.columns.units", {defaultValue: "Units"}), dataIndex: "unit_ids", key: "unit_ids",
            render: (unitIds: number[] | undefined) => (unitIds ?? []).length
        },
        {title: t("UserList.columns.status", {defaultValue: "Status"}), dataIndex: "status", key: "status"},
        {
            title: t("UserList.columns.actions", {defaultValue: "Actions"}), key: "actions", mobile: true,
            render: (_value: unknown, record: UserVO) => (
                    <Button type="primary" icon={<EditOutlined/>} onClick={() => onEdit(record.id)}
                            aria-label={t("UserList.actions.edit", {defaultValue: "Edit user"})}/>
            )
        }
    ];

    return (
            <Space direction="vertical" style={{width: "100%"}} size="large">
                {paged.contextHolder}
                <Space style={{justifyContent: "space-between", width: "100%"}}>
                    <h1>{t("UserList.title", {defaultValue: "Users"})}</h1>
                    <Button type="primary" icon={<PlusCircleFilled/>} onClick={onCreate}>
                        {t("UserList.actions.create", {defaultValue: "Create user"})}
                    </Button>
                </Space>
                <Spin spinning={paged.loading}>
                    <VempainTable<UserVO> dataMode="server" paged={paged} rowKey="id" columns={columns} scroll={{x: "max-content"}}/>
                </Spin>
            </Space>
    );
}
