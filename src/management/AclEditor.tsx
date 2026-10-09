import {Button, Col, Form, type FormInstance, Row, Select, Switch} from "antd";
import {MinusCircleFilled, PlusCircleFilled} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import type {AclVO, UnitVO, UserVO} from "../models";

export const ACL_PRIVILEGES = ["create_privilege", "read_privilege", "modify_privilege", "delete_privilege"] as const;
export type AclPrivilege = typeof ACL_PRIVILEGES[number];

export interface AclEditorProps {
    /** The rows to start from; the editor owns the `acls` Form.List of `parentForm` */
    acls: AclVO[];
    parentForm: FormInstance;
    /** Users offered as grantees */
    users: UserVO[];
    /** Units offered as grantees */
    units: UnitVO[];
    /** Name of the form list, `acls` by default */
    fieldName?: string;
}

function parseOptionalId(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "empty" || value === "") {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Editor of the ACL rows of an entity, shared by every editor of the admin and file SPAs. Each row grants one user or one unit a
 * combination of create, read, modify and delete. Rules: a row names either a user or a unit, read is always required, delete requires
 * modify, switching create on also switches read on, and the "All" button left of the switches grants every privilege of its row.
 */
export function AclEditor({acls, parentForm, users, units, fieldName = "acls"}: AclEditorProps) {
    const {t} = useTranslation();

    function validateAclRow(field: string, index: number): Promise<void> {
        if (field === "user" || field === "unit") {
            const userId = parseOptionalId(parentForm.getFieldValue([fieldName, index, "user"]));
            const unitId = parseOptionalId(parentForm.getFieldValue([fieldName, index, "unit"]));

            if (userId === undefined && unitId === undefined) {
                return Promise.reject(t("AclEditor.validation.userOrUnit", {defaultValue: "Either a user or a unit must be selected."}));
            }
            if (userId !== undefined && unitId !== undefined) {
                return Promise.reject(t("AclEditor.validation.notBoth", {defaultValue: "Select either a user or a unit, not both."}));
            }
        }

        if (field.endsWith("_privilege")) {
            const read = parentForm.getFieldValue([fieldName, index, "read_privilege"]);
            const modify = parentForm.getFieldValue([fieldName, index, "modify_privilege"]);
            const del = parentForm.getFieldValue([fieldName, index, "delete_privilege"]);

            if (!read) {
                return Promise.reject(t("AclEditor.validation.readRequired", {defaultValue: "Read privilege must be selected."}));
            }
            if ((field === "delete_privilege" || field === "modify_privilege") && del && !modify) {
                return Promise.reject(t("AclEditor.validation.deleteNeedsModify", {defaultValue: "Delete privilege requires modify privilege."}));
            }
        }

        return Promise.resolve();
    }

    /** Create implies read: switching create on also switches read on when it is still off */
    function onPrivilegeChange(rowName: number, privilege: AclPrivilege, checked: boolean) {
        parentForm.setFieldValue([fieldName, rowName, privilege], checked);
        if (privilege === "create_privilege" && checked && !parentForm.getFieldValue([fieldName, rowName, "read_privilege"])) {
            parentForm.setFieldValue([fieldName, rowName, "read_privilege"], true);
        }
        void parentForm.validateFields([[fieldName, rowName, "read_privilege"], [fieldName, rowName, privilege]]).catch(() => undefined);
    }

    function grantAllPrivileges(rowName: number) {
        for (const privilege of ACL_PRIVILEGES) {
            parentForm.setFieldValue([fieldName, rowName, privilege], true);
        }
        void parentForm.validateFields([[fieldName, rowName, "read_privilege"], [fieldName, rowName, "modify_privilege"]]).catch(() => undefined);
    }

    const privilegeLabel: Record<AclPrivilege, string> = {
        create_privilege: t("AclEditor.columns.create", {defaultValue: "Create"}),
        read_privilege: t("AclEditor.columns.read", {defaultValue: "Read"}),
        modify_privilege: t("AclEditor.columns.modify", {defaultValue: "Modify"}),
        delete_privilege: t("AclEditor.columns.delete", {defaultValue: "Delete"})
    };

    return (
            <>
                <Row gutter={16} align="middle">
                    <Col span={4}><strong>{t("AclEditor.columns.user", {defaultValue: "User"})}</strong></Col>
                    <Col span={4}><strong>{t("AclEditor.columns.unit", {defaultValue: "Unit"})}</strong></Col>
                    <Col span={2}><strong>{t("AclEditor.columns.all", {defaultValue: "All"})}</strong></Col>
                    {ACL_PRIVILEGES.map(privilege => <Col span={3} key={privilege}><strong>{privilegeLabel[privilege]}</strong></Col>)}
                </Row>

                <Form.List name={fieldName} initialValue={acls}>
                    {(fields, {add, remove}) => (
                            <>
                                {fields.map((field, index) => (
                                        <Row gutter={16} align="middle" key={field.key} data-testid="acl-row">
                                            <Col span={4}>
                                                <Form.Item name={[field.name, "permission_id"]} hidden={true}/>
                                                <Form.Item name={[field.name, "acl_id"]} hidden={true}/>
                                                <Form.Item name={[field.name, "user"]}
                                                           rules={[{validator: () => validateAclRow("user", index)}]}>
                                                    <Select placeholder={t("AclEditor.placeholders.user", {defaultValue: "Select user"})}
                                                            showSearch optionFilterProp="label" allowClear
                                                            options={users.map(user => ({value: user.id, label: `${user.name} (${user.login_name})`}))}/>
                                                </Form.Item>
                                            </Col>
                                            <Col span={4}>
                                                <Form.Item name={[field.name, "unit"]}
                                                           rules={[{validator: () => validateAclRow("unit", index)}]}>
                                                    <Select placeholder={t("AclEditor.placeholders.unit", {defaultValue: "Select unit"})}
                                                            showSearch optionFilterProp="label" allowClear
                                                            options={units.map(unit => ({value: unit.id, label: unit.name}))}/>
                                                </Form.Item>
                                            </Col>
                                            <Col span={2}>
                                                <Button size="small"
                                                        aria-label={t("AclEditor.actions.grantAll", {defaultValue: "Grant all privileges"})}
                                                        onClick={() => grantAllPrivileges(field.name)}>
                                                    {t("AclEditor.columns.all", {defaultValue: "All"})}
                                                </Button>
                                            </Col>
                                            {ACL_PRIVILEGES.map(privilege => (
                                                    <Col span={3} key={privilege}>
                                                        <Form.Item name={[field.name, privilege]} valuePropName="checked"
                                                                   rules={[{validator: () => validateAclRow(privilege, index)}]}>
                                                            <Switch onChange={checked => onPrivilegeChange(field.name, privilege, checked)}/>
                                                        </Form.Item>
                                                    </Col>
                                            ))}
                                            <Col span={2}>
                                                <Button type="text" danger icon={<MinusCircleFilled/>} onClick={() => remove(field.name)}
                                                        aria-label={t("AclEditor.actions.remove", {defaultValue: "Remove row"})}/>
                                            </Col>
                                        </Row>
                                ))}
                                <Form.Item>
                                    <Button type="dashed" block icon={<PlusCircleFilled/>} onClick={() => add({
                                        permission_id: 0, acl_id: 0, user: null, unit: null,
                                        create_privilege: false, read_privilege: true, modify_privilege: false, delete_privilege: false
                                    })}>
                                        {t("AclEditor.actions.add", {defaultValue: "Add ACL"})}
                                    </Button>
                                </Form.Item>
                            </>
                    )}
                </Form.List>
            </>
    );
}
