import { useState } from "react";
import { Alert, Button, Card, Layout, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { ADMIN_HR_USERS_PATH, ADMIN_PROFILES_PATH, clearAuth } from "../auth";

const PLACEHOLDER_MESSAGE = "Раздел будет реализован на следующем этапе";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const showPlaceholder = () => {
    setNotice(PLACEHOLDER_MESSAGE);
  };

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
                <Typography.Title level={2} style={{ margin: 0 }}>
                  Панель администратора
                </Typography.Title>
              </div>
              <Button onClick={logout}>Выйти</Button>
            </Space>
          </Card>

          {notice ? <Alert type="info" showIcon message={notice} /> : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <Card bordered={false}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  HR-пользователи
                </Typography.Title>
                <Button type="primary" block onClick={() => navigate(ADMIN_HR_USERS_PATH)}>
                  HR-пользователи
                </Button>
              </Space>
            </Card>

            <Card bordered={false}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  Профили оценки
                </Typography.Title>
                <Button type="primary" block onClick={() => navigate(ADMIN_PROFILES_PATH)}>
                  Профили оценки
                </Button>
              </Space>
            </Card>
          </div>
        </Space>
      </div>
    </Layout>
  );
}
