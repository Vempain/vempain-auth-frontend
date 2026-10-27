import {Button, Col, Form, type FormInstance, Row, Select, Switch} from "antd";
import {MinusCircleFilled, PlusCircleFilled} from "@ant-design/icons";
import {useTranslation} from "react-i18next";

/** The four privilege switches of an ACL row, in column order */
export const ACL_ROW_PRIVILEGES = ["create_privilege", "read_privilege", "modify_privilege", "delete_privilege"] as const;
export type AclRowPrivilege = typeof ACL_ROW_PRIVILEGES[number];

/**
 * Translation keys used by the editor with their English defaults. A host adds the `AclRow` keys to its locale files to translate
 * them; without them the defaults are shown.
 */
export const ACL_ROW_TRANSLATION_DEFAULTS = {
    "AclRow.columns.user": "User",
    "AclRow.columns.unit": "Unit",
    "AclRow.columns.all": "All",
    "AclRow.columns.create": "Create",
    "AclRow.columns.read": "Read",
    "AclRow.columns.modify": "Modify",
    "AclRow.columns.delete": "Delete",
    "AclRow.placeholders.user": "Select user",
    "AclRow.placeholders.unit": "Select unit",
    "AclRow.actions.grantAll": "Grant all privileges",
    "AclRow.actions.remove": "Remove row",
    "AclRow.actions.add": "Add ACL",
    "AclRow.validation.userRequired": "A user must be selected.",
    "AclRow.validation.userOrUnit": "Either a user or a unit must be selected.",
    "AclRow.validation.notBoth": "Select either a user or a unit, not both.",
    "AclRow.validation.readRequired": "Read privilege must be selected.",
    "AclRow.validation.deleteNeedsModify": "Delete privilege requires modify privilege.",
} as const;

type AclRowTranslationKey = keyof typeof ACL_ROW_TRANSLATION_DEFAULTS;

/** A user or unit offered as grantee: the ID stored in the row and the text shown in the dropdown */
export interface AclGranteeOption {
    value: number;
    label: string;
}

/** The privilege part of a row; the grantee fields are named by the host (`userField`/`unitField`) */
export interface AclRowPrivileges {
    create_privilege: boolean;
    read_privilege: boolean;
    modify_privilege: boolean;
    delete_privilege: boolean;
}

export type AclRowValues = AclRowPrivileges & Record<string, unknown>;

export interface AclRowsEditorProps {
    /** The form that owns the list; the editor reads and writes the rows through it */
    form: FormInstance;
    /** Name of the `Form.List` the editor owns, `acls` by default */
    fieldName?: string;
    /** Users offered as grantees */
    users: AclGranteeOption[];
    /** Units offered as grantees; leave out to get a user-only editor without a unit column */
    units?: AclGranteeOption[];
    /** Row field holding the chosen user ID, `user` by default (`user_id` in the publish requests of the file service) */
    userField?: string;
    /** Row field holding the chosen unit ID, `unit` by default */
    unitField?: string;
    /** Row fields carried along invisibly, for example the `permission_id` and `acl_id` of persisted ACL rows */
    hiddenFields?: string[];
    /** Rows the list starts with when the form has no value for it yet; any row type carrying the four privilege flags fits */
    initialValue?: AclRowPrivileges[];
    /** Builds a new row for the add button; by default read is on, everything else off and no grantee chosen */
    newRow?: () => AclRowPrivileges;
    /** When true every user and unit can be chosen in one row only and the add button stops when all are used */
    uniqueGrantees?: boolean;
    /** Forces the add button off, for example while the grantees are still loading */
    addDisabled?: boolean;
    /** Shows the column headers, on by default */
    showHeader?: boolean;
    /** `data-testid` of every row, `acl-row` by default */
    rowTestId?: string;
}

function parseOptionalId(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "empty" || value === "") {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function defaultAclRow(userField: string = "user", unitField: string = "unit"): AclRowValues {
    return {
        [userField]: null,
        [unitField]: null,
        create_privilege: false,
        read_privilege: true,
        modify_privilege: false,
        delete_privilege: false
    };
}

/**
 * Editor of a list of ACL rows, shared by every Vempain frontend that edits ACLs: the user and unit editors of this library (through
 * `AclEditor`), the content editors of the admin SPA and the publish dialogs of the file SPA. Each row grants one user or one unit a
 * combination of create, read, modify and delete through four switches, with an "All" button that grants every privilege of the row
 * at once. Rules: a row names either a user or a unit (a user when there is no unit column), read is always required, delete requires
 * modify and switching create on also switches read on. The host owns the form and maps the rows to its own request type.
 */
export function AclRowsEditor({
                                  form,
                                  fieldName = "acls",
                                  users,
                                  units,
                                  userField = "user",
                                  unitField = "unit",
                                  hiddenFields = [],
                                  initialValue,
                                  newRow,
                                  uniqueGrantees = false,
                                  addDisabled = false,
                                  showHeader = true,
                                  rowTestId = "acl-row"
                              }: AclRowsEditorProps) {
    const {t} = useTranslation();
    const text = (key: AclRowTranslationKey) => t(key, {defaultValue: ACL_ROW_TRANSLATION_DEFAULTS[key]});
    const hasUnits = units !== undefined;
    const rows = (Form.useWatch(fieldName, form) ?? []) as Array<Record<string, unknown> | undefined>;

    function validateGrantee(rowName: number): Promise<void> {
        const userId = parseOptionalId(form.getFieldValue([fieldName, rowName, userField]));
        const unitId = hasUnits ? parseOptionalId(form.getFieldValue([fieldName, rowName, unitField])) : undefined;

        if (userId === undefined && unitId === undefined) {
            return Promise.reject(new Error(text(hasUnits ? "AclRow.validation.userOrUnit" : "AclRow.validation.userRequired")));
        }
        if (userId !== undefined && unitId !== undefined) {
            return Promise.reject(new Error(text("AclRow.validation.notBoth")));
        }
        return Promise.resolve();
    }

    function validatePrivilege(rowName: number, privilege: AclRowPrivilege): Promise<void> {
        const read = form.getFieldValue([fieldName, rowName, "read_privilege"]);
        const modify = form.getFieldValue([fieldName, rowName, "modify_privilege"]);
        const del = form.getFieldValue([fieldName, rowName, "delete_privilege"]);

        if (!read) {
            return Promise.reject(new Error(text("AclRow.validation.readRequired")));
        }
        if ((privilege === "delete_privilege" || privilege === "modify_privilege") && del && !modify) {
            return Promise.reject(new Error(text("AclRow.validation.deleteNeedsModify")));
        }
        return Promise.resolve();
    }

    function revalidateRow(rowName: number) {
        void form.validateFields([
            [fieldName, rowName, userField],
            ...(hasUnits ? [[fieldName, rowName, unitField]] : []),
            ...ACL_ROW_PRIVILEGES.map(privilege => [fieldName, rowName, privilege])
        ]).catch(() => undefined);
    }

    /** Create implies read: switching create on also switches read on when it is still off */
    function onPrivilegeChange(rowName: number, privilege: AclRowPrivilege, checked: boolean) {
        form.setFieldValue([fieldName, rowName, privilege], checked);
        if (privilege === "create_privilege" && checked && !form.getFieldValue([fieldName, rowName, "read_privilege"])) {
            form.setFieldValue([fieldName, rowName, "read_privilege"], true);
        }
        revalidateRow(rowName);
    }

    function grantAllPrivileges(rowName: number) {
        for (const privilege of ACL_ROW_PRIVILEGES) {
            form.setFieldValue([fieldName, rowName, privilege], true);
        }
        revalidateRow(rowName);
    }

    function optionsFor(rowName: number, field: string, options: AclGranteeOption[]): AclGranteeOption[] {
        if (!uniqueGrantees) {
            return options;
        }
        const chosenElsewhere = new Set(rows.filter((_, index) => index !== rowName)
                .map(row => parseOptionalId(row?.[field]))
                .filter((id): id is number => id !== undefined));
        return options.filter(option => !chosenElsewhere.has(option.value));
    }

    const granteeCount = users.length + (units?.length ?? 0);
    const addButtonDisabled = addDisabled || (uniqueGrantees && rows.length >= granteeCount);
    const privilegeLabel: Record<AclRowPrivilege, string> = {
        create_privilege: text("AclRow.columns.create"),
        read_privilege: text("AclRow.columns.read"),
        modify_privilege: text("AclRow.columns.modify"),
        delete_privilege: text("AclRow.columns.delete")
    };
    const userSpan = hasUnits ? 4 : 8;

    return (
            <>
                {showHeader && (
                        <Row gutter={16} align="middle" data-testid={`${rowTestId}-header`}>
                            <Col span={userSpan}><strong>{text("AclRow.columns.user")}</strong></Col>
                            {hasUnits && <Col span={4}><strong>{text("AclRow.columns.unit")}</strong></Col>}
                            <Col span={2}><strong>{text("AclRow.columns.all")}</strong></Col>
                            {ACL_ROW_PRIVILEGES.map(privilege => <Col span={3} key={privilege}><strong>{privilegeLabel[privilege]}</strong></Col>)}
                        </Row>
                )}

                <Form.List name={fieldName} initialValue={initialValue}>
                    {(fields, {add, remove}) => (
                            <>
                                {fields.map(field => (
                                        <Row gutter={16} align="middle" key={field.key} data-testid={rowTestId}>
                                            <Col span={userSpan}>
                                                {hiddenFields.map(hidden => <Form.Item key={hidden} name={[field.name, hidden]} hidden={true}/>)}
                                                <Form.Item name={[field.name, userField]}
                                                           dependencies={hasUnits ? [[fieldName, field.name, unitField]] : undefined}
                                                           rules={[{validator: () => validateGrantee(field.name)}]}>
                                                    <Select placeholder={text("AclRow.placeholders.user")}
                                                            showSearch={{optionFilterProp: "label"}} allowClear
                                                            options={optionsFor(field.name, userField, users)}/>
                                                </Form.Item>
                                            </Col>
                                            {hasUnits && (
                                                    <Col span={4}>
                                                        <Form.Item name={[field.name, unitField]}
                                                                   dependencies={[[fieldName, field.name, userField]]}
                                                                   rules={[{validator: () => validateGrantee(field.name)}]}>
                                                            <Select placeholder={text("AclRow.placeholders.unit")}
                                                                    showSearch={{optionFilterProp: "label"}} allowClear
                                                                    options={optionsFor(field.name, unitField, units)}/>
                                                        </Form.Item>
                                                    </Col>
                                            )}
                                            <Col span={2}>
                                                <Button size="small"
                                                        aria-label={text("AclRow.actions.grantAll")}
                                                        onClick={() => grantAllPrivileges(field.name)}>
                                                    {text("AclRow.columns.all")}
                                                </Button>
                                            </Col>
                                            {ACL_ROW_PRIVILEGES.map(privilege => (
                                                    <Col span={3} key={privilege}>
                                                        <Form.Item name={[field.name, privilege]} valuePropName="checked"
                                                                   rules={[{validator: () => validatePrivilege(field.name, privilege)}]}>
                                                            <Switch aria-label={privilegeLabel[privilege]}
                                                                    onChange={checked => onPrivilegeChange(field.name, privilege, checked)}/>
                                                        </Form.Item>
                                                    </Col>
                                            ))}
                                            <Col span={2}>
                                                <Button type="text" danger icon={<MinusCircleFilled/>} onClick={() => remove(field.name)}
                                                        aria-label={text("AclRow.actions.remove")}/>
                                            </Col>
                                        </Row>
                                ))}
                                <Form.Item>
                                    <Button type="dashed" block icon={<PlusCircleFilled/>} disabled={addButtonDisabled}
                                            onClick={() => add(newRow ? newRow() : defaultAclRow(userField, unitField))}>
                                        {text("AclRow.actions.add")}
                                    </Button>
                                </Form.Item>
                            </>
                    )}
                </Form.List>
            </>
    );
}
