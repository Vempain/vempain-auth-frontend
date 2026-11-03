import {useEffect, useState} from "react";
import {Alert, Button, Form, Modal, Radio, Space, Typography} from "antd";
import {useTranslation} from "react-i18next";
import type {AclBulkEntry, AclBulkUpdateMode, AclBulkUpdateResponse, AclVO, UnitVO, UserVO} from "../models";
import {AclBulkUpdateModeEnum} from "../models";
import type {AclAPI} from "../services/AclAPI";
import type {UnitAPI} from "../services/UnitAPI";
import type {UserAPI} from "../services/UserAPI";
import {AclRowsEditor} from "./AclRowsEditor";
import {newAclRow, unitGranteeOptions, userGranteeOptions} from "./AclEditor";
import {completeAcls, loadUsersAndUnits} from "./managementTools";

/**
 * Translation keys of the bulk ACL dialog with their English defaults; a host adds the `AclBulk` keys to its locale files to translate them.
 * The number of selected resources is appended in parentheses to the button and the title, so a host without an i18n instance needs no
 * interpolation.
 */
export const ACL_BULK_TRANSLATION_DEFAULTS = {
    "AclBulk.button": "Permissions of selected",
    "AclBulk.title": "Permissions of the selected resources",
    "AclBulk.mode.label": "Existing permissions",
    "AclBulk.mode.add": "Keep and add these",
    "AclBulk.mode.replace": "Replace with these",
    "AclBulk.mode.addHint": "A user or unit already on a resource gets the privileges below, the other rows stay.",
    "AclBulk.mode.replaceHint": "Every existing row of the selected resources is removed first.",
    "AclBulk.actions.apply": "Apply",
    "AclBulk.actions.cancel": "Cancel",
    "AclBulk.messages.loadError": "Failed to load the users and units, try again later",
    "AclBulk.messages.updateError": "Failed to update the permissions",
    "AclBulk.messages.updated": "Permissions updated",
    "AclBulk.messages.skipped": "Some resources were skipped: the modify privilege on a resource is needed to change its permissions"
} as const;

type AclBulkTranslationKey = keyof typeof ACL_BULK_TRANSLATION_DEFAULTS;

export interface AclBulkEditorProps {
    /** Shows the dialog */
    open: boolean;
    /** The ACL ids of the selected resources */
    aclIds: number[];
    aclAPI: AclAPI;
    userAPI: UserAPI;
    unitAPI: UnitAPI;
    /** Rows the dialog starts with; by default one row with read granted and no grantee */
    initialRows?: AclVO[];
    /** Called when the dialog closes without applying */
    onCancel: () => void;
    /** Called after the backend applied the update, with its outcome; the host closes the dialog and reloads its list */
    onUpdated: (response: AclBulkUpdateResponse) => void;
}

/** The request rows of the dialog as bulk entries; the ids of `AclVO` rows play no part in a bulk update */
export function toBulkEntries(rows: AclVO[] | undefined | null): AclBulkEntry[] {
    return completeAcls(rows).map(row => ({
        user: row.user,
        unit: row.unit,
        create_privilege: row.create_privilege,
        read_privilege: row.read_privilege,
        modify_privilege: row.modify_privilege,
        delete_privilege: row.delete_privilege
    }));
}

/**
 * The dialog behind the "Permissions of selected" button of the list screens: the same ACL entries granted to every selected resource at
 * once, either merged into the existing rows (`ADD`) or replacing them (`REPLACE`). The rows are edited with `AclRowsEditor` (one row per
 * grantee), the grantees are the users and units of the host's backend, and the backend decides per ACL whether the caller may change it.
 */
export function AclBulkEditor({open, aclIds, aclAPI, userAPI, unitAPI, initialRows, onCancel, onUpdated}: AclBulkEditorProps) {
    const {t} = useTranslation();
    const text = (key: AclBulkTranslationKey) => t(key, {defaultValue: ACL_BULK_TRANSLATION_DEFAULTS[key]});
    const [form] = Form.useForm<{ acls: AclVO[] }>();
    const [users, setUsers] = useState<UserVO[]>([]);
    const [units, setUnits] = useState<UnitVO[]>([]);
    const [mode, setMode] = useState<AclBulkUpdateMode>(AclBulkUpdateModeEnum.ADD);
    // the grantees are loaded while the dialog is open and the lookup has not answered yet
    const [loaded, setLoaded] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const loading = open && !loaded;

    useEffect(() => {
        if (!open) {
            return;
        }
        let active = true;
        loadUsersAndUnits(userAPI, unitAPI)
                .then(lookup => {
                    if (!active) return;
                    setUsers(lookup.users);
                    setUnits(lookup.units);
                    setLoaded(true);
                    setError(null);
                })
                .catch(err => {
                    if (!active) return;
                    console.error("Failed to load the users and units:", err);
                    setLoaded(true);
                    setError(t("AclBulk.messages.loadError", {defaultValue: ACL_BULK_TRANSLATION_DEFAULTS["AclBulk.messages.loadError"]}));
                });
        return () => {
            active = false;
        };
    }, [open, userAPI, unitAPI, t]);

    function reset() {
        form.resetFields();
        setMode(AclBulkUpdateModeEnum.ADD);
        setLoaded(false);
        setError(null);
    }

    function close() {
        reset();
        onCancel();
    }

    async function apply() {
        let values: { acls: AclVO[] };
        try {
            values = await form.validateFields();
        } catch {
            return;
        }
        setSaving(true);
        try {
            const response = await aclAPI.bulkUpdate({acl_ids: aclIds, mode, entries: toBulkEntries(values.acls)});
            reset();
            onUpdated(response);
        } catch (err) {
            console.error("Failed to update the permissions:", err);
            setError(text("AclBulk.messages.updateError"));
        } finally {
            setSaving(false);
        }
    }

    return (
            <Modal open={open} title={`${text("AclBulk.title")} (${aclIds.length})`} onCancel={close} width={900} destroyOnHidden
                   footer={[
                       <Button key="cancel" onClick={close}>{text("AclBulk.actions.cancel")}</Button>,
                       <Button key="apply" type="primary" loading={saving} disabled={loading || aclIds.length === 0} onClick={() => void apply()}>
                           {text("AclBulk.actions.apply")}
                       </Button>
                   ]}>
                {error && <Alert type="error" title={error} showIcon style={{marginBottom: 16}}/>}
                <Space orientation="vertical" size="middle" style={{width: "100%"}}>
                    <div>
                        <Typography.Text strong>{text("AclBulk.mode.label")}</Typography.Text>
                        <div>
                            <Radio.Group value={mode} onChange={event => setMode(event.target.value as AclBulkUpdateMode)}
                                         options={[
                                             {value: AclBulkUpdateModeEnum.ADD, label: text("AclBulk.mode.add")},
                                             {value: AclBulkUpdateModeEnum.REPLACE, label: text("AclBulk.mode.replace")}
                                         ]}/>
                        </div>
                        <Typography.Text type="secondary">
                            {text(mode === AclBulkUpdateModeEnum.ADD ? "AclBulk.mode.addHint" : "AclBulk.mode.replaceHint")}
                        </Typography.Text>
                    </div>
                    <Form form={form} layout="vertical" initialValues={{acls: initialRows ?? [newAclRow()]}}>
                        <AclRowsEditor form={form} fieldName="acls" users={userGranteeOptions(users)} units={unitGranteeOptions(units)}
                                       hiddenFields={["permission_id", "acl_id"]} newRow={newAclRow} uniqueGrantees addDisabled={loading}/>
                    </Form>
                </Space>
            </Modal>
    );
}

export interface AclBulkUpdateButtonProps extends Omit<AclBulkEditorProps, "open" | "onCancel"> {
    /** Text of the button; by default "Permissions of selected (n)" */
    label?: string;
}

/**
 * The toolbar button of a list with selectable ACL-bearing rows: disabled until rows are selected, opens `AclBulkEditor` for their ACL ids
 * and closes it again after `onUpdated`.
 */
export function AclBulkUpdateButton({label, onUpdated, ...editor}: AclBulkUpdateButtonProps) {
    const {t} = useTranslation();
    const [open, setOpen] = useState<boolean>(false);
    return (
            <>
                <Button disabled={editor.aclIds.length === 0} onClick={() => setOpen(true)}>
                    {label ?? `${t("AclBulk.button", {defaultValue: ACL_BULK_TRANSLATION_DEFAULTS["AclBulk.button"]})} (${editor.aclIds.length})`}
                </Button>
                <AclBulkEditor {...editor} open={open} onCancel={() => setOpen(false)}
                               onUpdated={response => {
                                   setOpen(false);
                                   onUpdated(response);
                               }}/>
            </>
    );
}
