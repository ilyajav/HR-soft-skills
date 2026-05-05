import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { Navigate, useNavigate } from "react-router-dom";
import api, { getApiErrorMessage } from "../api";
import { getHomePathForRole, hasAuthToken, saveAuth } from "../auth";
import { getHrCabinetLabel } from "../hrAccount";
import type { AuthResponse } from "../types";

interface LoginFormState {
  username: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const hrCabinetLabel = getHrCabinetLabel();
  const [loginForm, setLoginForm] = useState<LoginFormState>({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  if (hasAuthToken()) {
    return <Navigate to={getHomePathForRole()} replace />;
  }

  const handleLogin = async () => {
    setLoading(true);
    setLoginError("");

    try {
      const response = await api.post<AuthResponse>("/auth/login/", loginForm);
      const role = saveAuth(response.data);
      navigate(getHomePathForRole(role));
    } catch (error) {
      setLoginError(getApiErrorMessage(error, "Не удалось войти. Проверьте логин и пароль."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section page-section--narrow">
      <Card className="login-panel" bordered={false}>
        <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>
          {hrCabinetLabel}
        </Typography.Title>

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

          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            Войти
          </Button>
        </Form>
      </Card>
    </div>
  );
}
