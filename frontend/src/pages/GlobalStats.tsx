import { Column, Pie } from "@ant-design/charts";
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
  theme as antdTheme,
  Typography,
} from "antd";
import { useNavigate } from "react-router-dom";
import api, { getApiErrorMessage } from "../api";
import type { StatisticsCompletedSession, StatisticsResponse } from "../types";

type StatisticsMetricKey = "average_dsi" | "average_sri" | "average_tcei";
type SessionMetricKey = "final_dsi" | "final_sri" | "final_tcei";

interface MetricChartDefinition {
  key: StatisticsMetricKey;
  sessionKey: SessionMetricKey;
  title: string;
  shortTitle: "DSI" | "SRI" | "TCEI";
  description: string;
  pieDescription: string;
  color: string;
}

interface PieChartDatum {
  test_title: string;
  candidate_name: string;
  value: number;
}

const PIE_COLOR_RANGE = [
  "#1677ff",
  "#52c41a",
  "#faad14",
  "#722ed1",
  "#eb2f96",
  "#13c2c2",
  "#fa8c16",
  "#2f54eb",
  "#a0d911",
  "#f5222d",
];

const METRIC_CHARTS: MetricChartDefinition[] = [
  {
    key: "average_dsi",
    sessionKey: "final_dsi",
    title: "Средний DSI",
    shortTitle: "DSI",
    description: "Средняя скорость принятия решений по завершенным результатам.",
    pieDescription:
      "Круговой график показывает вклад завершенных тестов в DSI. Цвет сектора соответствует тесту.",
    color: "#1677ff",
  },
  {
    key: "average_sri",
    sessionKey: "final_sri",
    title: "Средний SRI",
    shortTitle: "SRI",
    description: "Средняя стрессоустойчивость по завершенным результатам.",
    pieDescription:
      "Круговой график показывает вклад завершенных тестов в SRI. Цвет сектора соответствует тесту.",
    color: "#52c41a",
  },
  {
    key: "average_tcei",
    sessionKey: "final_tcei",
    title: "Средний TCEI",
    shortTitle: "TCEI",
    description: "Средняя итоговая эффективность по завершенным результатам.",
    pieDescription:
      "Круговой график показывает вклад завершенных тестов в TCEI. Легенда отображает названия тестов.",
    color: "#faad14",
  },
];

const hasMetricValue = (value: number | null | undefined): value is number => typeof value === "number";

const createMetricConfig = (
  title: string,
  value: number | null | undefined,
  color: string,
  textColor: string,
  chartTheme: Record<string, unknown>,
) => ({
  data: [{ metric: title, value: Number((value ?? 0).toFixed(1)) }],
  xField: "metric",
  yField: "value",
  height: 280,
  theme: chartTheme,
  legend: false,
  maxBarWidth: 96,
  style: {
    fill: color,
    stroke: color,
  },
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
    text: (datum: { value: number }) => `${datum.value}%`,
    position: "top",
    style: {
      fill: textColor,
      fontWeight: 600,
    },
  },
  tooltip: {
    title: false,
    items: [{ name: title, value: `${Number((value ?? 0).toFixed(1))}%` }],
  },
});

const createPieConfig = (
  data: PieChartDatum[],
  legendDomain: string[],
  chartTheme: Record<string, unknown>,
) => ({
  data,
  angleField: "value",
  colorField: "test_title",
  radius: 0.92,
  innerRadius: 0.5,
  height: 300,
  theme: chartTheme,
  label: false,
  scale: {
    color: {
      domain: legendDomain,
      range: PIE_COLOR_RANGE,
    },
  },
  legend: {
    color: {
      title: false,
    },
  },
  tooltip: {
    items: [
      (datum: PieChartDatum) => ({
        name: "Значение",
        value: `${datum.value}%`,
      }),
    ],
  },
});

export default function GlobalStats() {
  const navigate = useNavigate();
  const { token } = antdTheme.useToken();
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatistics = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<StatisticsResponse>("/hr/statistics/");
      setStats(response.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Не удалось загрузить общую статистику."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatistics();
  }, []);

  const legendDomain = useMemo(
    () => stats?.completed_sessions.map((session) => session.test_title) ?? [],
    [stats],
  );

  const chartTheme = useMemo(
    () => ({
      axis: {
        labelFill: token.colorText,
        labelOpacity: 1,
        titleFill: token.colorText,
        titleOpacity: 1,
        lineStroke: token.colorBorderSecondary,
        lineStrokeOpacity: 1,
        tickStroke: token.colorBorderSecondary,
        tickOpacity: 1,
        gridStroke: token.colorSplit,
        gridStrokeOpacity: 0.6,
      },
      legendCategory: {
        itemLabelFill: token.colorText,
        itemLabelFillOpacity: 1,
        itemValueFill: token.colorTextSecondary,
        itemValueFillOpacity: 1,
        titleFill: token.colorText,
        titleFillOpacity: 1,
        navButtonFill: token.colorText,
        navButtonFillOpacity: 0.85,
        navPageNumFill: token.colorTextSecondary,
        navPageNumFillOpacity: 1,
      },
      legendContinuous: {
        labelFill: token.colorText,
        labelFillOpacity: 1,
        handleLabelFill: token.colorText,
        handleLabelFillOpacity: 1,
        titleFill: token.colorText,
        titleFillOpacity: 1,
        tickStroke: token.colorBorderSecondary,
        tickStrokeOpacity: 1,
        handleMarkerStroke: token.colorText,
        handleMarkerStrokeOpacity: 0.8,
      },
      label: {
        fill: token.colorText,
        fillOpacity: 1,
        stroke: token.colorBgContainer,
      },
      innerLabel: {
        fill: token.colorText,
        fillOpacity: 1,
        stroke: token.colorBgContainer,
      },
      title: {
        titleFill: token.colorText,
        titleFillOpacity: 1,
        subtitleFill: token.colorTextSecondary,
        subtitleFillOpacity: 1,
      },
    }),
    [
      token.colorBgContainer,
      token.colorBorderSecondary,
      token.colorSplit,
      token.colorText,
      token.colorTextSecondary,
    ],
  );

  const metricVisuals = useMemo(
    () =>
      METRIC_CHARTS.map((metric) => {
        const value = stats?.[metric.key] ?? null;
        const pieData =
          stats?.completed_sessions
            .filter((session) => hasMetricValue(session[metric.sessionKey]))
            .map((session: StatisticsCompletedSession) => ({
              test_title: session.test_title,
              candidate_name: session.candidate_name || "Аноним",
              value: Number((session[metric.sessionKey] ?? 0).toFixed(2)),
            })) ?? [];

        return {
          ...metric,
          value,
          pieData,
          pieConfig: createPieConfig(pieData, legendDomain, chartTheme),
          columnConfig: createMetricConfig(
            metric.shortTitle,
            value,
            metric.color,
            token.colorText,
            chartTheme,
          ),
        };
      }),
    [chartTheme, legendDomain, stats, token.colorText],
  );

  const logout = () => {
    window.localStorage.removeItem("hr_token");
    window.localStorage.removeItem("hr_username");
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
                  Страница показывает завершенные результаты ваших сотрудников и считает средние
                  значения по DSI, SRI и TCEI на основе этих результатов.
                </Typography.Paragraph>
              </div>
              <Space wrap>
                <Button type="primary" onClick={() => navigate("/dashboard")}>
                  Список сотрудников
                </Button>
                <Button onClick={() => void loadStatistics()}>Обновить</Button>
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
                {metricVisuals.map((metric) => (
                  <Col key={`${metric.key}-pie`} xs={24} lg={8}>
                    <Card bordered={false} title={`Распределение ${metric.shortTitle} по тестам`}>
                      <Typography.Paragraph type="secondary" style={{ minHeight: 66 }}>
                        {metric.pieDescription}
                      </Typography.Paragraph>
                      {metric.pieData.length ? (
                        <Pie {...metric.pieConfig} />
                      ) : (
                        <Empty description={`Для ${metric.shortTitle} пока нет данных.`} />
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>

              <Row gutter={[16, 16]}>
                {metricVisuals.map((metric) => (
                  <Col key={metric.key} xs={24} lg={8}>
                    <Card bordered={false} title={metric.title}>
                      <Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>
                        {metric.description}
                      </Typography.Paragraph>
                      {hasMetricValue(metric.value) ? (
                        <Column {...metric.columnConfig} />
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
