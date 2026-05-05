import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Layout,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import { useNavigate } from "react-router-dom";
import api, { getApiErrorMessage } from "../api";
import { ADMIN_HOME_PATH, clearAuth } from "../auth";
import type { AdminHRUser, CreateHRUserPayload } from "../types";

interface HRUserFormState {
  username: string;
  password: string;
  confirmPassword: string;
}

const createEmptyForm = (): HRUserFormState => ({
  username: "",
  password: "",
  confirmPassword: "",
});

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function AdminHRUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminHRUser[]>([]);
  const [form, setForm] = useState<HRUserFormState>(createEmptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await api.get<AdminHRUser[]>("/admin/hr-users/");
      setUsers(response.data);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Не удалось загрузить список HR-пользователей."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const validateForm = (): string => {
    if (!form.username.trim()) {
      return "Логин обязателен.";
    }

    if (!form.password) {
      return "Пароль обязателен.";
    }

    if (form.password !== form.confirmPassword) {
      return "Пароли не совпадают.";
    }

    return "";
  };

  const createHrUser = async () => {
    const validationError = validateForm();
    setFormError(validationError);
    setSuccessMessage("");

    if (validationError) {
      return;
    }

    setSubmitting(true);

    try {
      const payload: CreateHRUserPayload = {
        username: form.username.trim(),
        password: form.password,
        confirm_password: form.confirmPassword,
      };
      const response = await api.post<AdminHRUser>("/admin/hr-users/", payload);
      setForm(createEmptyForm());
      setSuccessMessage(`HR-пользователь ${response.data.username} создан.`);
      await loadUsers();
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Не удалось создать HR-пользователя."));
    } finally {
      setSubmitting(false);
    }
  };

  const deactivateHrUser = async (userId: number) => {
    setDeactivatingId(userId);
    setLoadError("");
    setSuccessMessage("");

    try {
      await api.delete<AdminHRUser>(`/admin/hr-users/${userId}/`);
      setSuccessMessage("HR-пользователь отключён. Его тесты и результаты сохранены.");
      await loadUsers();
    } catch (error) {
      setLoadError(getApiErrorMessage(error, "Не удалось отключить HR-пользователя."));
    } finally {
      setDeactivatingId(null);
    }
  };

  const columns: TableProps<AdminHRUser>["columns"] = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "Логин",
      dataIndex: "username",
      key: "username",
      width: 220,
      ellipsis: true,
    },
    {
      title: "Дата создания",
      dataIndex: "date_joined",
      key: "date_joined",
      width: 190,
      render: (value: AdminHRUser["date_joined"]) => formatDateTime(value),
    },
    {
      title: "Тесты",
      dataIndex: "tests_count",
      key: "tests_count",
      width: 100,
    },
    {
      title: "Статус",
      key: "status",
      width: 130,
      render: (_: unknown, user) =>
        user.is_active ? <Tag color="success">Активен</Tag> : <Tag>Отключён</Tag>,
    },
    {
      title: "Действия",
      key: "actions",
      width: 150,
      render: (_: unknown, user) =>
        user.is_active ? (
          <Popconfirm
            title="Отключить HR-пользователя?"
            description="Его тесты и результаты сохранятся."
            okText="Отключить"
            cancelText="Отмена"
            okButtonProps={{ danger: true, loading: deactivatingId === user.id }}
            onConfirm={() => deactivateHrUser(user.id)}
          >
            <Button danger type="link" loading={deactivatingId === user.id}>
              Отключить
            </Button>
          </Popconfirm>
        ) : (
          <Button type="link" disabled>
            Отключён
          </Button>
        ),
    },
  ];

  return (
    <Layout className="app-shell">
      <div className="page-section">
        <Space direction="vertical" size={24} className="dashboard-stack" style={{ width: "100%" }}>
          <Card bordered={false}>
            <Space
              align="start"
              size="middle"
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div>
                <Typography.Text type="secondary">Панель администратора</Typography.Text>
                <Typography.Title level={2} style={{ margin: "8px 0 0" }}>
                  HR-пользователи
                </Typography.Title>
              </div>
              <Space wrap>
                <Button onClick={() => navigate(ADMIN_HOME_PATH)}>Назад</Button>
                <Button onClick={logout}>Выйти</Button>
              </Space>
            </Space>
          </Card>

          <Card bordered={false} title="Создать HR-пользователя">
            <Form layout="vertical" onFinish={createHrUser} requiredMark={false}>
              <div className="dashboard-form-grid">
                <Form.Item label="Логин" required>
                  <Input
                    size="large"
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, username: event.target.value }))
                    }
                  />
                </Form.Item>

                <Form.Item label="Пароль" required>
                  <Input.Password
                    size="large"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </Form.Item>

                <Form.Item label="Подтвердите пароль" required>
                  <Input.Password
                    size="large"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                </Form.Item>
              </div>

              {formError ? (
                <Alert style={{ marginBottom: 16 }} type="error" showIcon message={formError} />
              ) : null}

              {successMessage ? (
                <Alert
                  style={{ marginBottom: 16 }}
                  type="success"
                  showIcon
                  message={successMessage}
                />
              ) : null}

              <Button type="primary" htmlType="submit" loading={submitting}>
                Создать HR-пользователя
              </Button>
            </Form>
          </Card>

          <Card bordered={false} title="Список HR-пользователей">
            {loadError ? (
              <Alert style={{ marginBottom: 16 }} type="error" showIcon message={loadError} />
            ) : null}

            {loading ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <Spin size="large" />
              </div>
            ) : (
              <Table
                rowKey="id"
                dataSource={users}
                columns={columns}
                pagination={{ pageSize: 8 }}
                scroll={{ x: "max-content" }}
              />
            )}
          </Card>
        </Space>
      </div>
    </Layout>
  );
}
