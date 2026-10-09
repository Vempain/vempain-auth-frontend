import {Button, Space, Spin} from "antd";
import {EditOutlined, PlusCircleFilled} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import {usePagedTable} from "../main/usePagedTable";
import {type VempainColumnsType, VempainTable} from "../main/VempainTable";
import type {UnitVO} from "../models";
import type {UnitAPI} from "../services/UnitAPI";

export interface UnitListProps {
    unitAPI: UnitAPI;
    onEdit: (unitId: number) => void;
    onCreate: () => void;
}

/**
 * Server-paged list of the units of one backend with their member counts and edit/create actions.
 */
export function UnitList({unitAPI, onEdit, onCreate}: UnitListProps) {
    const {t} = useTranslation();
    const paged = usePagedTable<UnitVO>(request => unitAPI.findPageable(request), {defaultPageSize: 10, defaultSortBy: "name"});

    const columns: VempainColumnsType<UnitVO> = [
        {title: t("UnitList.columns.id", {defaultValue: "ID"}), dataIndex: "id", key: "id", sorter: true},
        {title: t("UnitList.columns.name", {defaultValue: "Name"}), dataIndex: "name", key: "name", sorter: true, mobile: true},
        {title: t("UnitList.columns.description", {defaultValue: "Description"}), dataIndex: "description", key: "description"},
        {
            title: t("UnitList.columns.users", {defaultValue: "Users"}), dataIndex: "user_ids", key: "user_ids",
            render: (ids: number[] | undefined) => (ids ?? []).length
        },
        {
            title: t("UnitList.columns.subUnits", {defaultValue: "Sub-units"}), dataIndex: "unit_ids", key: "unit_ids",
            render: (ids: number[] | undefined) => (ids ?? []).length
        },
        {
            title: t("UnitList.columns.actions", {defaultValue: "Actions"}), key: "actions", mobile: true,
            render: (_value: unknown, record: UnitVO) => (
                    <Button type="primary" icon={<EditOutlined/>} onClick={() => onEdit(record.id)}
                            aria-label={t("UnitList.actions.edit", {defaultValue: "Edit unit"})}/>
            )
        }
    ];

    return (
            <Space direction="vertical" style={{width: "100%"}} size="large">
                {paged.contextHolder}
                <Space style={{justifyContent: "space-between", width: "100%"}}>
                    <h1>{t("UnitList.title", {defaultValue: "Units"})}</h1>
                    <Button type="primary" icon={<PlusCircleFilled/>} onClick={onCreate}>
                        {t("UnitList.actions.create", {defaultValue: "Create unit"})}
                    </Button>
                </Space>
                <Spin spinning={paged.loading}>
                    <VempainTable<UnitVO> dataMode="server" paged={paged} rowKey="id" columns={columns} scroll={{x: "max-content"}}/>
                </Spin>
            </Space>
    );
}
