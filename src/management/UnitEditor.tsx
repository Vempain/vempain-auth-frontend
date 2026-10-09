import {Alert, Button, Form, Input, Select, Space, Spin} from "antd";
import {type ReactNode, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import dayjs from "dayjs";
import type {UnitVO, UserVO} from "../models";
import type {UnitAPI} from "../services/UnitAPI";
import type {UserAPI} from "../services/UserAPI";
import {selectableMemberUnits, wouldCreateUnitCycle} from "../tools/unitTools";
import {AclEditor} from "./AclEditor";
import {completeAcls, fullAclFor, loadUsersAndUnits} from "./managementTools";
import {AuditLine, type EntityMetadata} from "./UserEditor";

export interface UnitEditorProps {
    unitAPI: UnitAPI;
    userAPI: UserAPI;
    /** 0 creates a new unit */
    unitId: number;
    /** Id of the signed-in user; a new unit starts with an ACL row granting this user every privilege */
    currentUserId?: number;
    onSaved: (unit: UnitVO) => void;
    onCancel?: () => void;
    renderMetadata?: (metadata: EntityMetadata) => ReactNode;
}

function emptyUnit(currentUserId: number | undefined): UnitVO {
    return {
        id: 0,
        name: "",
        description: "",
        acls: currentUserId ? [fullAclFor(currentUserId)] : [],
        user_ids: [],
        unit_ids: [],
        creator: 0,
        created: dayjs(),
        modifier: null,
        modified: null,
        locked: false
    };
}

/**
 * Create/edit form of a unit of one backend: name, description, its member users, its member units and its ACL. Units nest, so the
 * member unit select only offers units that can not lead back to this unit (`selectableMemberUnits`), and the form refuses a circular
 * choice before the backend's own backstop would.
 */
export function UnitEditor({unitAPI, userAPI, unitId, currentUserId, onSaved, onCancel, renderMetadata}: UnitEditorProps) {
    const {t} = useTranslation();
    const [form] = Form.useForm<UnitVO>();
    const [unit, setUnit] = useState<UnitVO | null>(null);
    const [users, setUsers] = useState<UserVO[]>([]);
    const [units, setUnits] = useState<UnitVO[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        // Load the unit (or an empty one) together with the lookup lists; the state is touched only from the promise callbacks
        const load = unitId > 0 ? unitAPI.findById(unitId, null) : Promise.resolve(emptyUnit(currentUserId));
        Promise.all([load, loadUsersAndUnits(userAPI, unitAPI)])
                .then(([loaded, lookup]) => {
                    if (!active) return;
                    setUnit({...loaded, acls: loaded.acls ?? [], user_ids: loaded.user_ids ?? [], unit_ids: loaded.unit_ids ?? []});
                    setUsers(lookup.users);
                    setUnits(lookup.units);
                    setError(null);
                })
                .catch(err => {
                    if (!active) return;
                    console.error("Failed to load the unit:", err);
                    setError(t("UnitEditor.messages.loadError", {defaultValue: "Failed to load the unit, try again later"}));
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        return () => {
            active = false;
        };
    }, [unitAPI, userAPI, unitId, currentUserId, t]);

    const memberUnitOptions = selectableMemberUnits(unitId, units).map(candidate => ({value: candidate.id, label: candidate.name}));

    function validateMemberUnits(_rule: unknown, value: number[] | undefined): Promise<void> {
        if (unitId > 0 && value && wouldCreateUnitCycle(unitId, value, units)) {
            return Promise.reject(new Error(t("UnitEditor.validation.cycle", {
                defaultValue: "A unit can not contain itself, directly or through other units"
            })));
        }
        return Promise.resolve();
    }

    function onFinish(values: UnitVO) {
        if (unit === null) return;
        const payload: UnitVO = {
            ...unit,
            ...values,
            id: unit.id,
            acls: completeAcls(values.acls),
            user_ids: values.user_ids ?? [],
            unit_ids: values.unit_ids ?? []
        };
        setSaving(true);
        setError(null);
        const operation = unitId > 0 ? unitAPI.update(payload) : unitAPI.create(payload);
        operation
                .then(saved => onSaved(saved))
                .catch(err => {
                    console.error("Failed to save the unit:", err);
                    setError(unitId > 0
                            ? t("UnitEditor.messages.updateError", {defaultValue: "Failed to update the unit"})
                            : t("UnitEditor.messages.createError", {defaultValue: "Failed to create the unit"}));
                })
                .finally(() => setSaving(false));
    }

    const metadata: EntityMetadata | null = unit === null ? null
            : {creator: unit.creator, created: unit.created, modifier: unit.modifier, modified: unit.modified};

    return (
            <Spin spinning={loading || saving}>
                <h1>{unitId > 0
                        ? t("UnitEditor.title.edit", {defaultValue: "Edit unit {{name}}", name: unit?.name ?? unitId})
                        : t("UnitEditor.title.create", {defaultValue: "Create new unit"})}</h1>
                {error !== null && <Alert type="error" showIcon title={error} style={{marginBottom: 16}}/>}
                {unit !== null && (
                        <Form form={form} initialValues={unit} onFinish={onFinish} labelCol={{span: 6}} wrapperCol={{span: 18}}
                              style={{maxWidth: 1400}} autoComplete="off" name="UnitEditorForm">
                            <Form.Item name="name" label={t("UnitEditor.fields.name", {defaultValue: "Unit name"})} rules={[{required: true}]}>
                                <Input/>
                            </Form.Item>
                            <Form.Item name="description" label={t("UnitEditor.fields.description", {defaultValue: "Description"})}>
                                <Input.TextArea rows={2}/>
                            </Form.Item>
                            <Form.Item name="user_ids" label={t("UnitEditor.fields.users", {defaultValue: "Member users"})}>
                                <Select mode="multiple" allowClear showSearch optionFilterProp="label"
                                        placeholder={t("UnitEditor.placeholders.users", {defaultValue: "Select users"})}
                                        options={users.map(user => ({value: user.id, label: `${user.name} (${user.login_name})`}))}/>
                            </Form.Item>
                            <Form.Item name="unit_ids" label={t("UnitEditor.fields.units", {defaultValue: "Member units"})}
                                       rules={[{validator: validateMemberUnits}]}
                                       extra={t("UnitEditor.hints.units", {
                                           defaultValue: "Units that contain this unit are not offered, because a unit can never contain itself"
                                       })}>
                                <Select mode="multiple" allowClear showSearch optionFilterProp="label"
                                        placeholder={t("UnitEditor.placeholders.units", {defaultValue: "Select units"})}
                                        options={memberUnitOptions}/>
                            </Form.Item>
                            <Form.Item label={t("UnitEditor.fields.acl", {defaultValue: "Access control"})}>
                                <AclEditor acls={unit.acls} parentForm={form} users={users} units={units}/>
                            </Form.Item>
                            {metadata !== null && unitId > 0 && (
                                    <Form.Item label=" " colon={false}>
                                        {renderMetadata ? renderMetadata(metadata) : <AuditLine metadata={metadata}/>}
                                    </Form.Item>
                            )}
                            <Form.Item wrapperCol={{offset: 6, span: 18}}>
                                <Space>
                                    <Button type="primary" htmlType="submit">{t("UnitEditor.actions.save", {defaultValue: "Save"})}</Button>
                                    {onCancel && <Button onClick={onCancel}>{t("UnitEditor.actions.cancel", {defaultValue: "Cancel"})}</Button>}
                                </Space>
                            </Form.Item>
                        </Form>
                )}
            </Spin>
    );
}
