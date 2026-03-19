import { useState } from "react";
import { Alert, Button, Card, Form, Input, Tabs, Typography } from "antd";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../api";

const LOGIN_TAB = "login";
const REGISTER_TAB = "register";

const getApiErrorMessage = (error, fallbackMessage) => {
  const data = error.response?.data;

  if (!data) {
    return fallbackMessage;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data.detail === "string") {
    return data.detail;
  }

  const firstValue = Object.values(data)[0];
  if (Array.isArray(firstValue) && firstValue.length) {
    return firstValue[0];
  }

  return fallbackMessage;
};

export default function Login() {
  const navigate = useNavigate();
  const existingToken = localStorage.getItem("hr_token");
  const [activeTab, setActiveTab] = useState(LOGIN_TAB);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    confirm_password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [loading, setLoading] = useState(false);

  if (existingToken) {
    return <Navigate to="/dashboard" replace />;
  }

  const saveAuth = (response) => {
    localStorage.setItem("hr_token", response.data.token);
    localStorage.setItem("hr_username", response.data.username);
    navigate("/dashboard");
  };

  const handleLogin = async () => {
    setLoading(true);
    setLoginError("");

    try {
      const response = await api.post("/auth/login/", loginForm);
      saveAuth(response);
    } catch {
      setLoginError("Не удалось войти. Проверьте логин и пароль.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setRegisterError("");

    try {
      const response = await api.post("/auth/register/", registerForm);
      saveAuth(response);
    } catch (error) {
      setRegisterError(getApiErrorMessage(error, "Не удалось создать аккаунт HR."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section page-section--narrow">
      <Card className="login-panel" bordered={false}>
        <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
          Кабинет HR
        </Typography.Title>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: LOGIN_TAB,
              label: "Вход",
              children: (
                <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
                  <Form.Item label="Логин" required>
                    <Input
                      size="large"
                      value={loginForm.username}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                  </Form.Item>

                  <Form.Item label="Пароль" required>
                    <Input.Password
                      size="large"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />
                  </Form.Item>

                  {loginError ? (
                    <Form.Item>
                      <Alert type="error" showIcon message={loginError} />
                    </Form.Item>
                  ) : null}

                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={loading && activeTab === LOGIN_TAB}
                  >
                    Войти в кабинет
                  </Button>
                </Form>
              ),
            },
            {
              key: REGISTER_TAB,
              label: "Регистрация",
              children: (
                <Form layout="vertical" onFinish={handleRegister} requiredMark={false}>
                  <Form.Item label="Логин" required>
                    <Input
                      size="large"
                      value={registerForm.username}
                      onChange={(event) =>
                        setRegisterForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>

                  <Form.Item label="Пароль" required extra="Минимум 8 символов.">
                    <Input.Password
                      size="large"
                      value={registerForm.password}
                      onChange={(event) =>
                        setRegisterForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>

                  <Form.Item label="Подтвердите пароль" required>
                    <Input.Password
                      size="large"
                      value={registerForm.confirm_password}
                      onChange={(event) =>
                        setRegisterForm((current) => ({
                          ...current,
                          confirm_password: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>

                  {registerError ? (
                    <Form.Item>
                      <Alert type="error" showIcon message={registerError} />
                    </Form.Item>
                  ) : null}

                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={loading && activeTab === REGISTER_TAB}
                  >
                    Создать аккаунт HR
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
