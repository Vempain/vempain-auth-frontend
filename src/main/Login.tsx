import {Alert, Button, Checkbox, Form, Input, Space, Spin} from "antd";
import {useState} from "react";
import {useSession} from "../session";
import {type NavigateFunction, useNavigate} from "react-router-dom";
import type {LoginRequest} from "../models/Requests";
import {ActionResult, ActionResultEnum, type LoginStatus, type SubmitResult} from "../models";

function Login() {
    type FieldType = {
        username?: string;
        password?: string;
        remember?: string;
    };

    const [loading, setLoading] = useState<boolean>(false);
    const {loginUser} = useSession();
    const navigate: NavigateFunction = useNavigate();
    const [loginResults, setLoginResults] = useState<SubmitResult>({status: ActionResult.NO_CHANGE, message: ""});

    async function onFinish(values: any): Promise<void> {
        setLoading(true);

        const loginRequest: LoginRequest = {
            login: values.username,
            password: values.password
        };

        const loginStatus: LoginStatus = await loginUser(loginRequest);

        if (!loginStatus || loginStatus.status === ActionResultEnum.FAILURE) {
            setLoginResults({status: ActionResult.FAIL, message: "Failed to log in user"});
        } else {
            navigate("/");
        }

        setLoading(false);
    }

    const onFinishFailed = (errorInfo: any) => {
        console.log("Failed:", errorInfo);
    };

    function clearStateOnBackButton() {
        navigate("/");
    }

    if (loginResults.status === ActionResult.FAIL) {
        return (<div>
            <Alert type={"error"}
                   message={loginResults.message}
                   showIcon
                   action={<Button type={"primary"}
                                   onClick={() => clearStateOnBackButton()}>{"Return to front page"}</Button>}
            />
        </div>);
    }

    return (
            <div className={"DarkDiv"}>
                <Spin tip={"Loading"} spinning={loading}>
                    <Space
                            direction={"vertical"}
                            style={{width: "100%", margin: 30}}
                            align={"center"}
                            size={"large"}
                    >
                        <Form
                                name="basic"
                                labelCol={{span: 8}}
                                wrapperCol={{span: 16}}
                                style={{maxWidth: 600, margin: "auto"}}
                                initialValues={{remember: true}}
                                onFinish={onFinish}
                                onFinishFailed={onFinishFailed}
                                autoComplete="off"
                        >
                            <Form.Item<FieldType>
                                    label="Username"
                                    name="username"
                                    rules={[{required: true, message: "Please input your username!"}]}
                            >
                                <Input autoFocus/>
                            </Form.Item>

                            <Form.Item<FieldType>
                                    label="Password"
                                    name="password"
                                    rules={[{required: true, message: "Please input your password!"}]}
                            >
                                <Input.Password/>
                            </Form.Item>

                            <Form.Item<FieldType>
                                    name="remember"
                                    valuePropName="checked"
                                    wrapperCol={{offset: 8, span: 16}}
                            >
                                <Checkbox>Remember me</Checkbox>
                            </Form.Item>

                            <Form.Item wrapperCol={{offset: 8, span: 16}}>
                                <Button type={"primary"} htmlType={"submit"}>
                                    Submit
                                </Button>
                            </Form.Item>
                        </Form>
                    </Space>
                </Spin>
            </div>
    );
}

export {Login};