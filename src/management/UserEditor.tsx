import {Alert, Button, Descriptions, Form, Input, Select, Space, Spin, Switch} from "antd";
import {type ReactNode, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import dayjs from "dayjs";
import type {UnitVO, UserVO} from "../models";
import type {UnitAPI} from "../services/UnitAPI";
import type {UserAPI} from "../services/UserAPI";
import {AclEditor} from "./AclEditor";
import {completeAcls, fullAclFor, loadUsersAndUnits} from "./managementTools";

export const PRIVACY_TYPES = ["PRIVATE", "GROUP", "PUBLIC"] as const;

export interface EntityMetadata {
    creator: number;
    created: UserVO["created"];
    modifier: number | null;
    modified: UserVO["modified"];
}

export interface UserEditorProps {
    userAPI: UserAPI;
    unitAPI: UnitAPI;
    /** 0 creates a new user */
    userId: number;
    /** Id of the signed-in user; a new user starts with an ACL row granting this user every privilege */
    currentUserId?: number;
    onSaved: (user: UserVO) => void;
    onCancel?: () => void;
    /** Optional replacement of the built-in audit line (created by / modified by) */
    renderMetadata?: (metadata: EntityMetadata) => ReactNode;
}

function emptyUser(currentUserId: number | undefined): UserVO {
    return {
        id: 0,
        private_user: false,
        name: "",
        nick: "",
        login_name: "",
        privacy_type: "PRIVATE",
        email: "",
        street: "",
        pob: "",
        birthday: dayjs().toDate(),
        description: "",
        password: "",
        acls: currentUserId ? [fullAclFor(currentUserId)] : [],
        unit_ids: [],
        creator: 0,
        created: dayjs(),
        modifier: null,
        modified: null,
        locked: false
    };
}

/**
 * Create/edit form of a user account of one backend: account fields, the units the user is a direct member of, and its ACL. The
 * password is required for a new user and optional (unchanged when blank) for an existing one.
 */
export function UserEditor({userAPI, unitAPI, userId, currentUserId, onSaved, onCancel, renderMetadata}: UserEditorProps) {
    const {t} = useTranslation();
    const [form] = Form.useForm<UserVO>();
    const [user, setUser] = useState<UserVO | null>(null);
    const [users, setUsers] = useState<UserVO[]>([]);
    const [units, setUnits] = useState<UnitVO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        // Load the user (or an empty one) together with the lookup lists; the state is touched only from the promise callbacks
        const load = userId > 0 ? userAPI.findById(userId, null) : Promise.resolve(emptyUser(currentUserId));
        Promise.all([load, loadUsersAndUnits(userAPI, unitAPI)])
                .then(([loaded, lookup]) => {
                    if (!active) return;
                    setUser({...loaded, password: "", acls: loaded.acls ?? [], unit_ids: loaded.unit_ids ?? []});
                    setUsers(lookup.users);
                    setUnits(lookup.units);
                    setError(null);
                })
                .catch(err => {
                    if (!active) return;
                    console.error("Failed to load the user:", err);
                    setError(t("UserEditor.messages.loadError", {defaultValue: "Failed to load the user, try again later"}));
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        return () => {
            active = false;
        };
    }, [userAPI, unitAPI, userId, currentUserId, t]);

    function onFinish(values: UserVO) {
        if (user === null) return;
        const payload: UserVO = {
            ...user,
            ...values,
            id: user.id,
            acls: completeAcls(values.acls),
            unit_ids: values.unit_ids ?? [],
            password: values.password ?? ""
        };
        setSaving(true);
        setError(null);
        const operation = userId > 0 ? userAPI.update(payload) : userAPI.create(payload);
        operation
                .then(saved => onSaved(saved))
                .catch(err => {
                    console.error("Failed to save the user:", err);
                    setError(userId > 0
                            ? t("UserEditor.messages.updateError", {defaultValue: "Failed to update the user"})
                            : t("UserEditor.messages.createError", {defaultValue: "Failed to create the user"}));
                })
                .finally(() => setSaving(false));
    }

    const metadata: EntityMetadata | null = user === null ? null
            : {creator: user.creator, created: user.created, modifier: user.modifier, modified: user.modified};

    return (
            <Spin spinning={loading || saving}>
                <h1>{userId > 0
                        ? t("UserEditor.title.edit", {defaultValue: "Edit user {{name}}", name: user?.login_name ?? userId})
                        : t("UserEditor.title.create", {defaultValue: "Create new user"})}</h1>
                {error !== null && <Alert type="error" showIcon title={error} style={{marginBottom: 16}}/>}
                {user !== null && (
                        <Form form={form} initialValues={user} onFinish={onFinish} labelCol={{span: 6}} wrapperCol={{span: 18}}
                              style={{maxWidth: 1400}} autoComplete="off" name="UserEditorForm">
                            <Form.Item name="private_user" label={t("UserEditor.fields.privateUser", {defaultValue: "Private user"})}
                                       valuePropName="checked">
                                <Switch/>
                            </Form.Item>
                            <Form.Item name="login_name" label={t("UserEditor.fields.loginName", {defaultValue: "Login name"})}
                                       rules={[{required: true}]}>
                                <Input/>
                            </Form.Item>
                            <Form.Item name="name" label={t("UserEditor.fields.name", {defaultValue: "Name"})} rules={[{required: true}]}>
                                <Input/>
                            </Form.Item>
                            <Form.Item name="nick" label={t("UserEditor.fields.nick", {defaultValue: "Nick"})} rules={[{required: true}]}>
                                <Input/>
                            </Form.Item>
                            <Form.Item name="email" label={t("UserEditor.fields.email", {defaultValue: "Email"})}
                                       rules={[{required: true}, {type: "email"}]}>
                                <Input/>
                            </Form.Item>
                            <Form.Item name="privacy_type" label={t("UserEditor.fields.privacyType", {defaultValue: "Privacy type"})}>
                                <Select options={PRIVACY_TYPES.map(type => ({value: type, label: type}))}/>
                            </Form.Item>
                            <Form.Item name="password" label={t("UserEditor.fields.password", {defaultValue: "Password"})}
                                       rules={[{required: userId === 0}]}
                                       extra={userId > 0 ? t("UserEditor.hints.password", {defaultValue: "Leave empty to keep the current password"}) : undefined}>
                                <Input.Password autoComplete="new-password"/>
                            </Form.Item>
                            <Form.Item name="street" label={t("UserEditor.fields.street", {defaultValue: "Street"})}><Input/></Form.Item>
                            <Form.Item name="pob" label={t("UserEditor.fields.pob", {defaultValue: "Post office box"})}><Input/></Form.Item>
                            <Form.Item name="birthday" label={t("UserEditor.fields.birthday", {defaultValue: "Birthday (YYYY-MM-DD)"})}><Input/></Form.Item>
                            <Form.Item name="description" label={t("UserEditor.fields.description", {defaultValue: "Description"})}>
                                <Input.TextArea rows={2}/>
                            </Form.Item>
                            <Form.Item name="unit_ids" label={t("UserEditor.fields.units", {defaultValue: "Member of units"})}>
                                <Select mode="multiple" allowClear showSearch optionFilterProp="label"
                                        placeholder={t("UserEditor.placeholders.units", {defaultValue: "Select units"})}
                                        options={units.map(unit => ({value: unit.id, label: unit.name}))}/>
                            </Form.Item>
                            <Form.Item label={t("UserEditor.fields.acl", {defaultValue: "Access control"})}>
                                <AclEditor acls={user.acls} parentForm={form} users={users} units={units}/>
                            </Form.Item>
                            {metadata !== null && userId > 0 && (
                                    <Form.Item label=" " colon={false}>
                                        {renderMetadata ? renderMetadata(metadata) : <AuditLine metadata={metadata}/>}
                                    </Form.Item>
                            )}
                            <Form.Item wrapperCol={{offset: 6, span: 18}}>
                                <Space>
                                    <Button type="primary" htmlType="submit">{t("UserEditor.actions.save", {defaultValue: "Save"})}</Button>
                                    {onCancel && <Button onClick={onCancel}>{t("UserEditor.actions.cancel", {defaultValue: "Cancel"})}</Button>}
                                </Space>
                            </Form.Item>
                        </Form>
                )}
            </Spin>
    );
}

/** Compact read-only audit trail used when the host does not supply its own */
export function AuditLine({metadata}: { metadata: EntityMetadata }) {
    const {t} = useTranslation();
    const stamp = (value: EntityMetadata["created"] | EntityMetadata["modified"]) => value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "–";
    return (
            <Descriptions size="small" column={{xs: 1, sm: 2, lg: 4}} colon={false} items={[
                {key: "creator", label: t("AuditLine.createdBy", {defaultValue: "Created by"}), children: `#${metadata.creator}`},
                {key: "created", label: t("AuditLine.created", {defaultValue: "Created"}), children: stamp(metadata.created)},
                {key: "modifier", label: t("AuditLine.modifiedBy", {defaultValue: "Modified by"}), children: metadata.modifier ? `#${metadata.modifier}` : "–"},
                {key: "modified", label: t("AuditLine.modified", {defaultValue: "Modified"}), children: stamp(metadata.modified)}
            ]}/>
    );
}
