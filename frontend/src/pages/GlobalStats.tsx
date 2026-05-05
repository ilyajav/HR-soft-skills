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
  Select,
  Space,
  Spin,
  Statistic,
  theme as antdTheme,
  Typography,
} from "antd";
import { useNavigate } from "react-router-dom";
import api, { getApiErrorMessage } from "../api";
import { clearAuth } from "../auth";
import { getHrCabinetLabel } from "../hrAccount";
import type { AssessmentProfile, StatisticsCompletedSession, StatisticsResponse } from "../types";

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
  value: number;
  total_value: number;
  sessions_count: number;
}

const TOP_TESTS_LIMIT = 10;
const BASE_PROFILE_NAME = "Базовый профиль";

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
  "#8c8c8c",
];

const METRIC_CHARTS: MetricChartDefinition[] = [
  {
    key: "average_dsi",
    sessionKey: "final_dsi",
    title: "Средний DSI",
    shortTitle: "DSI",
    description: "Средняя скорость принятия решений по завершенным результатам.",
    pieDescription:
      "Круговой график показывает топ-10 тестов по суммарному вкладу в DSI.",
    color: "#1677ff",
  },
  {
    key: "average_sri",
    sessionKey: "final_sri",
    title: "Средний SRI",
    shortTitle: "SRI",
    description: "Средняя стрессоустойчивость по завершенным результатам.",
    pieDescription:
      "Круговой график показывает топ-10 тестов по суммарному вкладу в SRI.",
    color: "#52c41a",
  },
  {
    key: "average_tcei",
    sessionKey: "final_tcei",
    title: "Средний TCEI",
    shortTitle: "TCEI",
    description: "Средняя итоговая эффективность по завершенным результатам.",
    pieDescription:
      "Круговой график показывает топ-10 тестов по суммарному вкладу в TCEI.",
    color: "#faad14",
  },
];

const hasMetricValue = (value: number | null | undefined): value is number => typeof value === "number";

const getDefaultProfile = (profiles: AssessmentProfile[]): AssessmentProfile | null =>
  profiles.find((profile) => profile.name === BASE_PROFILE_NAME) ?? profiles[0] ?? null;

const buildProfileOptionLabel = (profile: AssessmentProfile): string =>
  `${profile.name}, версия ${profile.version}${profile.is_archived ? " (архивный)" : ""}`;

const createTopTestContributionData = (
  sessions: StatisticsCompletedSession[],
  sessionKey: SessionMetricKey,
): PieChartDatum[] => {
  const groupedByTest = new Map<string, { totalValue: number; sessionsCount: number }>();

  for (const session of sessions) {
    const metricValue = session[sessionKey];
    if (!hasMetricValue(metricValue)) {
      continue;
    }

    const current = groupedByTest.get(session.test_title) ?? { totalValue: 0, sessionsCount: 0 };
    current.totalValue += metricValue;
    current.sessionsCount += 1;
    groupedByTest.set(session.test_title, current);
  }

  const sortedTests = Array.from(groupedByTest.entries())
    .map(([testTitle, stats]) => ({
      test_title: testTitle,
      total_value: stats.totalValue,
      sessions_count: stats.sessionsCount,
    }))
    .sort((left, right) => right.total_value - left.total_value)
    .slice(0, TOP_TESTS_LIMIT);

  const totalValue = sortedTests.reduce((sum, test) => sum + test.total_value, 0);
  if (!totalValue) {
    return [];
  }

  return sortedTests.map((test) => ({
    ...test,
    total_value: Number(test.total_value.toFixed(2)),
    value: Number(((test.total_value / totalValue) * 100).toFixed(2)),
  }));
};

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
      domain: data.map((item) => item.test_title),
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
        name: "Доля в топ-10",
        value: `${datum.value}%`,
      }),
      (datum: PieChartDatum) => ({
        name: "Сумма значений",
        value: datum.total_value.toFixed(2),
      }),
      (datum: PieChartDatum) => ({
        name: "Завершенные сессии",
        value: String(datum.sessions_count),
      }),
    ],
  },
});

export default function GlobalStats() {
  const navigate = useNavigate();
  const hrCabinetLabel = getHrCabinetLabel();
  const { token } = antdTheme.useToken();
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [profiles, setProfiles] = useState<AssessmentProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatistics = async (profileId = selectedProfileId) => {
    if (!profileId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.get<StatisticsResponse>("/hr/statistics/", {
        params: { profile_id: profileId },
      });
      setStats(response.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Не удалось загрузить общую статистику."));
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async (): Promise<number | null> => {
    setProfilesLoading(true);

    try {
      const response = await api.get<AssessmentProfile[]>("/hr/assessment-profiles/", {
        params: { mode: "filter" },
      });
      setProfiles(response.data);
      const defaultProfile = getDefaultProfile(response.data);
      const defaultProfileId = defaultProfile?.id ?? null;
      setSelectedProfileId((current) =>
        current && response.data.some((profile) => profile.id === current)
          ? current
          : defaultProfileId,
      );
      return defaultProfileId;
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Не удалось загрузить профили оценки."));
      return null;
    } finally {
      setProfilesLoading(false);
    }
  };

  useEffect(() => {
    const initializeStatistics = async () => {
      const defaultProfileId = await loadProfiles();
      await loadStatistics(defaultProfileId);
    };

    void initializeStatistics();
  }, []);

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
        const pieData = stats
          ? createTopTestContributionData(stats.completed_sessions, metric.sessionKey)
          : [];

        return {
          ...metric,
          value,
          pieData,
          pieConfig: createPieConfig(pieData, chartTheme),
          columnConfig: createMetricConfig(
            metric.shortTitle,
            value,
            metric.color,
            token.colorText,
            chartTheme,
          ),
        };
      }),
    [chartTheme, stats, token.colorText],
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  const logout = () => {
    clearAuth();
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
                <Typography.Text type="secondary">{hrCabinetLabel}</Typography.Text>
                <Typography.Title level={2} style={{ margin: "8px 0 0" }}>
                  Общая статистика по сотрудникам
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  Страница показывает завершенные результаты ваших сотрудников и считает средние
                  значения по DSI, SRI и TCEI на основе этих результатов.
                </Typography.Paragraph>
                <Space direction="vertical" size={8} style={{ marginTop: 16, minWidth: 320 }}>
                  <Typography.Text strong>Профиль оценки</Typography.Text>
                  <Select
                    loading={profilesLoading}
                    value={selectedProfileId ?? undefined}
                    options={profiles.map((profile) => ({
                      value: profile.id,
                      label: buildProfileOptionLabel(profile),
                    }))}
                    onChange={(value) => {
                      setSelectedProfileId(value);
                      void loadStatistics(value);
                    }}
                    notFoundContent={profilesLoading ? <Spin size="small" /> : "Нет доступных профилей"}
                  />
                  {selectedProfile ? (
                    <Typography.Text type="secondary">
                      Статистика по профилю: {selectedProfile.name}, версия {selectedProfile.version}
                      {selectedProfile.is_archived ? " (архивный)" : ""}.
                    </Typography.Text>
                  ) : null}
                </Space>
              </div>
              <Space wrap>
                <Button type="primary" onClick={() => navigate("/dashboard")}>
                  Список сотрудников
                </Button>
                <Button
                  onClick={() => {
                    void loadProfiles();
                    void loadStatistics();
                  }}
                >
                  Обновить
                </Button>
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
              {stats.total_sessions === 0 ? (
                <Alert
                  type="info"
                  showIcon
                  message="По выбранному профилю пока нет завершённых тестов."
                />
              ) : null}

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
                    <Card bordered={false} title={`Распределение ${metric.shortTitle} по тестам: топ-10`}>
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
