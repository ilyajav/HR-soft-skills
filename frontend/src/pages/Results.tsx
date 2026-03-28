import { Column } from "@ant-design/charts";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Layout, Space, Spin, Statistic, Table, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import api, { getApiErrorMessage } from "../api";
import type { CandidateSessionCriticalityResult, CandidateSessionDetail } from "../types";

const METRIC_LABELS = {
  DSI: "Индекс скорости принятия решений",
  SRI: "Индекс стрессоустойчивости",
  TCEI: "Итоговый индекс эффективности",
} as const;

type MetricCode = keyof typeof METRIC_LABELS;
type SessionMetricField = "final_dsi" | "final_sri" | "final_tcei";

interface ResultChartDatum {
  metric: string;
  score: number;
  color: string;
}

const METRIC_META: Record<MetricCode, { key: SessionMetricField; color: string }> = {
  DSI: { key: "final_dsi", color: "#1768ac" },
  SRI: { key: "final_sri", color: "#2f855a" },
  TCEI: { key: "final_tcei", color: "#b7791f" },
};

const CRITICALITY_TAG_COLORS: Record<number, string> = {
  1: "blue",
  2: "gold",
  3: "red",
};

const criticalityColumns: TableProps<CandidateSessionCriticalityResult>["columns"] = [
  {
    title: "Карточка",
    dataIndex: "card_text",
    key: "card_text",
  },
  {
    title: "Правильная критичность",
    key: "expected_criticality",
    render: (_: unknown, record) => (
      <Tag color={CRITICALITY_TAG_COLORS[record.expected_criticality_level]}>
        {record.expected_criticality_label}
      </Tag>
    ),
  },
  {
    title: "Выбрал кандидат",
    key: "assigned_criticality",
    render: (_: unknown, record) =>
      record.assigned_criticality_level ? (
        <Tag color={CRITICALITY_TAG_COLORS[record.assigned_criticality_level]}>
          {record.assigned_criticality_label}
        </Tag>
      ) : (
        <Typography.Text type="secondary">Нет данных</Typography.Text>
      ),
  },
  {
    title: "Статус",
    key: "status",
    render: (_: unknown, record) => {
      if (record.is_correct === true) {
        return <Tag color="success">Верно</Tag>;
      }

      if (record.is_correct === false) {
        return <Tag color="error">Неверно</Tag>;
      }

      return <Tag>Нет данных</Tag>;
    },
  },
];

export default function Results() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [session, setSession] = useState<CandidateSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) {
        setError("Некорректный идентификатор результата.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api.get<CandidateSessionDetail>(`/hr/sessions/${sessionId}/`);
        setSession(response.data);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "Не удалось загрузить результат."));
      } finally {
        setLoading(false);
      }
    };

    void loadSession();
  }, [sessionId]);

  const selectedMetricTags = useMemo(() => {
    if (!session) {
      return [];
    }

    const metrics: string[] = [];
    if (session.calc_dsi) {
      metrics.push(METRIC_LABELS.DSI);
    }
    if (session.calc_sri) {
      metrics.push(METRIC_LABELS.SRI);
    }
    if (session.calc_tcei) {
      metrics.push(METRIC_LABELS.TCEI);
    }

    return metrics;
  }, [session]);

  const resultChartData = useMemo<ResultChartDatum[]>(() => {
    if (!session) {
      return [];
    }

    return (Object.entries(METRIC_META) as Array<[MetricCode, (typeof METRIC_META)[MetricCode]]>).reduce<
      ResultChartDatum[]
    >((accumulator, [metric, meta]) => {
        const score = session[meta.key];
        if (typeof score === "number") {
          accumulator.push({
            metric: METRIC_LABELS[metric],
            score: Number(score.toFixed(2)),
            color: meta.color,
          });
        }

        return accumulator;
      }, []);
  }, [session]);

  const chartConfig = {
    data: resultChartData,
    xField: "metric",
    yField: "score",
    colorField: "metric",
    height: 320,
    legend: false,
  };

  const criticalityResults = session?.criticality_results ?? [];
  const hasCriticalityData =
    criticalityResults.length > 0 &&
    (session?.criticality_missing_count ?? 0) < (session?.criticality_total_count ?? 0);

  if (loading) {
    return (
      <div className="page-section page-section--narrow" style={{ justifyContent: "center" }}>
        <Card bordered={false} style={{ width: "100%", textAlign: "center" }}>
          <Space direction="vertical" size="middle">
            <Spin size="large" />
            <Typography.Text type="secondary">Загрузка результата...</Typography.Text>
          </Space>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-section page-section--narrow" style={{ justifyContent: "center" }}>
        <Card bordered={false} style={{ width: "100%" }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert type="error" showIcon message={error} />
            <Button onClick={() => navigate("/dashboard")}>Вернуться в кабинет</Button>
          </Space>
        </Card>
      </div>
    );
  }

  if (!session) {
    return null;
  }

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
                <Typography.Text type="secondary">Результат теста</Typography.Text>
                <Typography.Title level={2} style={{ margin: "8px 0 0" }}>
                  {session.test_title}
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                  {session.candidate_name || "Сотрудник без имени"}
                </Typography.Paragraph>
              </div>
              <Button onClick={() => navigate("/dashboard")}>Назад к списку тестов</Button>
            </Space>
          </Card>

          <Space size={[4, 8]} wrap>
            {selectedMetricTags.map((metric) => (
              <Tag key={metric}>{metric}</Tag>
            ))}
            {!session.is_completed ? (
              <Tag color="processing">Открыт</Tag>
            ) : (
              <Tag color="success">Завершен</Tag>
            )}
          </Space>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            <Card bordered={false}>
              <Statistic
                title={METRIC_LABELS.DSI}
                value={typeof session.final_dsi === "number" ? session.final_dsi : undefined}
                precision={2}
                suffix={session.final_dsi !== null ? "%" : ""}
              />
            </Card>
            <Card bordered={false}>
              <Statistic
                title={METRIC_LABELS.SRI}
                value={typeof session.final_sri === "number" ? session.final_sri : undefined}
                precision={2}
                suffix={session.final_sri !== null ? "%" : ""}
              />
            </Card>
            <Card bordered={false}>
              <Statistic
                title={METRIC_LABELS.TCEI}
                value={typeof session.final_tcei === "number" ? session.final_tcei : undefined}
                precision={2}
                suffix={session.final_tcei !== null ? "%" : ""}
              />
            </Card>
          </div>

          <Card bordered={false} title="Распределение по критичности">
            <Typography.Paragraph type="secondary">
              Здесь видно, в какие таблицы критичности кандидат разложил карточки и где его выбор
              совпал с правильным ответом.
            </Typography.Paragraph>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <Card bordered={false}>
                <Statistic title="Распределено верно" value={session.criticality_correct_count} />
              </Card>
              <Card bordered={false}>
                <Statistic title="Ошибок в распределении" value={session.criticality_incorrect_count} />
              </Card>
              <Card bordered={false}>
                <Statistic title="Всего карточек" value={session.criticality_total_count} />
              </Card>
            </div>

            {session.criticality_missing_count ? (
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message={`Для ${session.criticality_missing_count} карточек нет данных о выборе кандидата.`}
              />
            ) : null}

            {hasCriticalityData ? (
              <Table
                rowKey="card_id"
                dataSource={criticalityResults}
                columns={criticalityColumns}
                pagination={false}
                scroll={{ x: 900 }}
              />
            ) : (
              <Empty description="Для этой сессии пока нет данных по распределению карточек." />
            )}
          </Card>

          <Card bordered={false} title="График результата">
            {session.is_completed && resultChartData.length ? (
              <Column {...chartConfig} />
            ) : (
              <Empty description="Для этой сессии пока нет готовых результатов." />
            )}
          </Card>
        </Space>
      </div>
    </Layout>
  );
}
