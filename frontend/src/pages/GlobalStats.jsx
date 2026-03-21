import { Column } from "@ant-design/charts";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Layout,
  Row,
  Space,
  Spin,
  Statistic,
  Typography,
} from "antd";
import { useNavigate } from "react-router-dom";
import api from "../api";

const METRIC_CHARTS = [
  {
    key: "average_dsi",
    title: "Средний DSI",
    shortTitle: "DSI",
    description: "Средняя скорость принятия решений по завершённым результатам.",
    color: "#1768ac",
  },
  {
    key: "average_sri",
    title: "Средний SRI",
    shortTitle: "SRI",
    description: "Средняя стрессоустойчивость по завершённым результатам.",
    color: "#2f855a",
  },
  {
    key: "average_tcei",
    title: "Средний TCEI",
    shortTitle: "TCEI",
    description: "Средняя итоговая эффективность по завершённым результатам.",
    color: "#d69e2e",
  },
];

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

  return fallbackMessage;
};

const hasMetricValue = (value) => typeof value === "number";

const createMetricConfig = (title, value, color) => ({
  data: [{ metric: title, value: Number((value ?? 0).toFixed(1)) }],
  xField: "metric",
  yField: "value",
  height: 280,
  legend: false,
  color: color,
  maxBarWidth: 96,
  scale: {
    y: {
      domainMin: 0,
      domainMax: 100,
    },
  },
  axis: {
    x: {
      title: false,
      labelAutoHide: false,
    },
    y: {
      title: "Среднее значение, %",
    },
  },
  label: {
    text: (datum) => `${datum.value}%`,
    position: "top",
    style: {
      fontWeight: 600,
    },
  },
  tooltip: {
    title: false,
    items: [{ name: title, value: `${Number((value ?? 0).toFixed(1))}%` }],
  },
});

export default function GlobalStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatistics = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/hr/statistics/");
      setStats(response.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Не удалось загрузить общую статистику."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  const metricConfigs = useMemo(
    () =>
      METRIC_CHARTS.map((metric) => ({
        ...metric,
        value: stats?.[metric.key] ?? null,
        config: createMetricConfig(metric.shortTitle, stats?.[metric.key], metric.color),
      })),
    [stats],
  );

  const logout = () => {
    localStorage.removeItem("hr_token");
    localStorage.removeItem("hr_username");
    navigate("/login");
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
                <Typography.Text type="secondary">Кабинет HR</Typography.Text>
                <Typography.Title level={2} style={{ margin: "8px 0 0" }}>
                  Общая статистика по сотрудникам
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Страница показывает завершённые результаты ваших сотрудников и считает средние
                  значения по DSI, SRI и TCEI на основе этих результатов.
                </Typography.Paragraph>
              </div>
              <Space wrap>
                <Button type="primary" onClick={() => navigate("/dashboard")}>
                  Список сотрудников
                </Button>
                <Button onClick={loadStatistics}>Обновить</Button>
                <Button onClick={logout}>Выйти</Button>
              </Space>
            </Space>
          </Card>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          {loading ? (
            <Card bordered={false}>
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <Spin size="large" />
              </div>
            </Card>
          ) : stats ? (
            <>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} xl={6}>
                  <Card bordered={false}>
                    <Statistic
                      title="Сотрудников с результатом"
                      value={stats.total_sessions ?? 0}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Card bordered={false}>
                    <Statistic
                      title="Средний DSI"
                      value={stats.average_dsi ?? undefined}
                      precision={1}
                      suffix={hasMetricValue(stats.average_dsi) ? "%" : ""}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Card bordered={false}>
                    <Statistic
                      title="Средний SRI"
                      value={stats.average_sri ?? undefined}
                      precision={1}
                      suffix={hasMetricValue(stats.average_sri) ? "%" : ""}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <Card bordered={false}>
                    <Statistic
                      title="Средний TCEI"
                      value={stats.average_tcei ?? undefined}
                      precision={1}
                      suffix={hasMetricValue(stats.average_tcei) ? "%" : ""}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                {metricConfigs.map((metric) => (
                  <Col key={metric.key} xs={24} lg={8}>
                    <Card bordered={false} title={metric.title}>
                      <Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>
                        {metric.description}
                      </Typography.Paragraph>
                      {hasMetricValue(metric.value) ? (
                        <Column {...metric.config} />
                      ) : (
                        <Empty description={`Для ${metric.shortTitle} пока нет данных.`} />
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          ) : (
            <Card bordered={false}>
              <Empty description="Статистика временно недоступна." />
            </Card>
          )}
        </Space>
      </div>
    </Layout>
  );
}
