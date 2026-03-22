import { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Layout,
  Popconfirm,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import { useNavigate } from "react-router-dom";
import api, { getApiErrorMessage } from "../api";
import type {
  AssessmentCardDraft,
  AssessmentFormState,
  CandidateSession,
  CreatedAssessmentResponse,
} from "../types";

const METRIC_LABELS = {
  DSI: "Индекс скорости принятия решений",
  SRI: "Индекс стрессоустойчивости",
  TCEI: "Итоговый индекс эффективности",
} as const;

type MetricSelectionKey = "calc_dsi" | "calc_sri" | "calc_tcei";

const DUPLICATE_TITLE_ERROR = "Тест с таким названием уже существует.";

const createEmptyForm = (): AssessmentFormState => ({
  title: "",
  calc_dsi: true,
  calc_sri: true,
  calc_tcei: true,
  cards: [
    { text: "", criticality_level: 1 },
    { text: "", criticality_level: 2 },
    { text: "", criticality_level: 3 },
  ],
});

const CRITICALITY_OPTIONS = [
  { label: "Низкая критичность", value: 1 },
  { label: "Средняя критичность", value: 2 },
  { label: "Высокая критичность", value: 3 },
];

const normalizeMetricSelection = (
  metrics: Pick<AssessmentFormState, MetricSelectionKey>,
): Pick<AssessmentFormState, MetricSelectionKey> => {
  const nextMetrics = { ...metrics };
  nextMetrics.calc_tcei = nextMetrics.calc_dsi && nextMetrics.calc_sri;
  return nextMetrics;
};

const normalizeTitle = (title: string): string => title.trim().replace(/\s+/g, " ").toLocaleLowerCase();

const getFieldErrorMessage = (error: unknown, fieldName: string): string | null => {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const responseData = error.response?.data;
  if (!responseData || typeof responseData !== "object" || Array.isArray(responseData)) {
    return null;
  }

  const fieldValue = (responseData as Record<string, unknown>)[fieldName];
  if (typeof fieldValue === "string") {
    return fieldValue;
  }

  if (Array.isArray(fieldValue) && typeof fieldValue[0] === "string") {
    return fieldValue[0];
  }

  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CandidateSession[]>([]);
  const [createdLink, setCreatedLink] = useState("");
  const [form, setForm] = useState<AssessmentFormState>(createEmptyForm);
  const [loading, setLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [formError, setFormError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingTestId, setDeletingTestId] = useState<number | null>(null);

  const loadSessions = async ({ silent = false }: { silent?: boolean } = {}): Promise<void> => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await api.get<CandidateSession[]>("/hr/sessions/");
      setSessions(response.data);
      setSessionsError("");
    } catch {
      setSessionsError(
        silent
          ? "Автообновление временно недоступно. Показаны последние загруженные результаты."
          : "Не удалось загрузить данные кабинета.",
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadSessions();
    const intervalId = window.setInterval(() => {
      void loadSessions({ silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!titleError) {
      return;
    }

    setTitleError(hasDuplicateTitle(form.title) ? DUPLICATE_TITLE_ERROR : "");
  }, [sessions, form.title, titleError]);

  const logout = () => {
    window.localStorage.removeItem("hr_token");
    window.localStorage.removeItem("hr_username");
    navigate("/login");
  };

  const hasDuplicateTitle = (title: string): boolean => {
    const normalizedTitle = normalizeTitle(title);
    if (!normalizedTitle) {
      return false;
    }

    return sessions.some((session) => normalizeTitle(session.test_title) === normalizedTitle);
  };

  const updateCard = <K extends keyof AssessmentCardDraft>(
    index: number,
    key: K,
    value: AssessmentCardDraft[K],
  ) => {
    setForm((current) => ({
      ...current,
      cards: current.cards.map((card, cardIndex) =>
        cardIndex === index ? { ...card, [key]: value } : card,
      ),
    }));
  };

  const addCard = () => {
    setForm((current) => ({
      ...current,
      cards: [...current.cards, { text: "", criticality_level: 1 }],
    }));
  };

  const updateMetric = (key: MetricSelectionKey, checked: boolean) => {
    setForm((current) => {
      if (key === "calc_tcei") {
        return {
          ...current,
          ...normalizeMetricSelection({
            calc_dsi: checked,
            calc_sri: checked,
            calc_tcei: checked,
          }),
        };
      }

      return {
        ...current,
        ...normalizeMetricSelection({
          calc_dsi: key === "calc_dsi" ? checked : current.calc_dsi,
          calc_sri: key === "calc_sri" ? checked : current.calc_sri,
          calc_tcei: current.calc_tcei,
        }),
      };
    });
  };

  const createAssessment = async () => {
    setSubmitting(true);
    setFormError("");
    setCreatedLink("");
    const trimmedTitle = form.title.trim();
    if (hasDuplicateTitle(trimmedTitle)) {
      setTitleError(DUPLICATE_TITLE_ERROR);
      setSubmitting(false);
      return;
    }

    setTitleError("");

    try {
      const payload = {
        ...form,
        title: trimmedTitle,
        cards: form.cards.filter((card) => card.text.trim() !== ""),
      };
      const response = await api.post<CreatedAssessmentResponse>("/hr/tests/", payload);
      setCreatedLink(`${window.location.origin}/play/${response.data.session_token}`);
      setForm(createEmptyForm());
      setTitleError("");
      await loadSessions();
    } catch (error) {
      const nextTitleError = getFieldErrorMessage(error, "title");
      setTitleError(nextTitleError ?? "");
      setFormError(
        nextTitleError ? "" : getApiErrorMessage(error, "Не удалось создать новый тест."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAssessment = async (testId: number) => {
    setDeletingTestId(testId);
    setSessionsError("");

    try {
      await api.delete(`/hr/tests/${testId}/`);
      await loadSessions({ silent: true });
    } catch (error) {
      setSessionsError(getApiErrorMessage(error, "Не удалось удалить тест."));
    } finally {
      setDeletingTestId(null);
    }
  };

  const completedSessions = sessions.filter((session) => session.is_completed);

  const tableColumns: TableProps<CandidateSession>["columns"] = [
    {
      title: "Тест",
      dataIndex: "test_title",
      key: "test_title",
    },
    {
      title: "Сотрудник",
      dataIndex: "candidate_name",
      key: "candidate_name",
      render: (value: CandidateSession["candidate_name"]) => value || "Аноним",
    },
    {
      title: "Метрики",
      key: "metrics",
      render: (_: unknown, session: CandidateSession) => (
        <Space size={[4, 8]} wrap>
          {session.calc_dsi ? <Tag color="blue">{METRIC_LABELS.DSI}</Tag> : null}
          {session.calc_sri ? <Tag color="green">{METRIC_LABELS.SRI}</Tag> : null}
          {session.calc_tcei ? <Tag color="gold">{METRIC_LABELS.TCEI}</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Статус",
      dataIndex: "is_completed",
      key: "is_completed",
      render: (value: CandidateSession["is_completed"]) =>
        value ? <Tag color="success">Завершен</Tag> : <Tag color="processing">Открыт</Tag>,
    },
    {
      title: METRIC_LABELS.DSI,
      dataIndex: "final_dsi",
      key: "final_dsi",
      render: (value: CandidateSession["final_dsi"]) =>
        typeof value === "number" ? `${value.toFixed(2)}%` : "-",
    },
    {
      title: METRIC_LABELS.SRI,
      dataIndex: "final_sri",
      key: "final_sri",
      render: (value: CandidateSession["final_sri"]) =>
        typeof value === "number" ? `${value.toFixed(2)}%` : "-",
    },
    {
      title: METRIC_LABELS.TCEI,
      dataIndex: "final_tcei",
      key: "final_tcei",
      render: (value: CandidateSession["final_tcei"]) =>
        typeof value === "number" ? `${value.toFixed(2)}%` : "-",
    },
    {
      title: "Ссылка",
      key: "public_link",
      width: 280,
      render: (_: unknown, session: CandidateSession) => (
        <Typography.Link
          href={`${window.location.origin}/play/${session.token}`}
          target="_blank"
          style={{ whiteSpace: "nowrap" }}
        >
          Открыть страницу тестирования
        </Typography.Link>
      ),
    },
    {
      title: "Результат",
      key: "results",
      render: (_: unknown, session: CandidateSession) =>
        session.is_completed ? (
          <Button type="link" onClick={() => navigate(`/results/${session.id}`)}>
            Открыть страницу результата
          </Button>
        ) : (
          <Typography.Text type="secondary">Нет данных</Typography.Text>
        ),
    },
    {
      title: "Действия",
      key: "actions",
      render: (_: unknown, session: CandidateSession) =>
        session.test_id ? (
          <Popconfirm
            title="Удалить тест?"
            description="Будут удалены тест, карточки и связанная сессия кандидата."
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true, loading: deletingTestId === session.test_id }}
            onConfirm={() => deleteAssessment(session.test_id)}
          >
            <Button danger type="link" loading={deletingTestId === session.test_id}>
              Удалить тест
            </Button>
          </Popconfirm>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
  ];

  const canSubmit = Boolean(
    form.title.trim() &&
      form.cards.some((card) => card.text.trim()) &&
      (form.calc_dsi || form.calc_sri || form.calc_tcei),
  );

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
                  Создание тестов и просмотр результатов
                </Typography.Title>
              </div>
              <Space wrap>
                <Button type="primary" onClick={() => navigate("/statistics")}>
                  Общая статистика
                </Button>
                <Button onClick={() => void loadSessions()}>Обновить</Button>
                <Button onClick={logout}>Выйти</Button>
              </Space>
            </Space>
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <Card bordered={false}>
              <Statistic title="Отправлено тестов" value={sessions.length} />
            </Card>
            <Card bordered={false}>
              <Statistic title="Завершено" value={completedSessions.length} />
            </Card>
            <Card bordered={false}>
              <Statistic
                title="Ожидают ответа"
                value={sessions.filter((session) => !session.is_completed).length}
              />
            </Card>
          </div>

          <Card bordered={false} title="Создать новый тест">
            <Typography.Paragraph type="secondary">
              Сформулируйте задания, назначьте уровень критичности для каждой карточки и выберите,
              какие метрики нужно проверить в этом тесте.
            </Typography.Paragraph>

            <Form layout="vertical" onFinish={createAssessment} requiredMark={false}>
              <div className="dashboard-form-grid">
                <Form.Item
                  label="Название теста"
                  required
                  validateStatus={titleError ? "error" : undefined}
                  help={titleError || undefined}
                >
                  <Input
                    size="large"
                    value={form.title}
                    onChange={(event) => {
                      const nextTitle = event.target.value;
                      setForm((current) => ({ ...current, title: nextTitle }));
                      setTitleError(hasDuplicateTitle(nextTitle) ? DUPLICATE_TITLE_ERROR : "");
                    }}
                  />
                </Form.Item>

                <Form.Item label="Метрики для оценки">
                  <Space direction="vertical" size="small">
                    <Checkbox
                      checked={form.calc_dsi}
                      onChange={(event) => updateMetric("calc_dsi", event.target.checked)}
                    >
                      Индекс скорости принятия решений (DSI)
                    </Checkbox>
                    <Checkbox
                      checked={form.calc_sri}
                      onChange={(event) => updateMetric("calc_sri", event.target.checked)}
                    >
                      Индекс стрессоустойчивости (SRI)
                    </Checkbox>
                    <Checkbox
                      checked={form.calc_tcei}
                      onChange={(event) => updateMetric("calc_tcei", event.target.checked)}
                    >
                      Итоговый индекс эффективности (TCEI)
                    </Checkbox>
                    <Typography.Text type="secondary">
                      Если выбрать DSI и SRI, TCEI включится автоматически. Выбор TCEI сразу
                      включает и DSI, и SRI.
                    </Typography.Text>
                  </Space>
                </Form.Item>
              </div>

              <Typography.Title level={4} style={{ marginTop: 8 }}>
                Задания
              </Typography.Title>

              {form.cards.map((card, index) => (
                <div key={index} className="dashboard-card-row">
                  <Input
                    size="large"
                    value={card.text}
                    onChange={(event) => updateCard(index, "text", event.target.value)}
                    placeholder={`Задание ${index + 1}`}
                  />
                  <Select
                    size="large"
                    value={card.criticality_level}
                    options={CRITICALITY_OPTIONS}
                    onChange={(value) => updateCard(index, "criticality_level", value)}
                  />
                </div>
              ))}

              <Space
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  marginTop: 24,
                }}
              >
                <Button onClick={addCard}>Добавить задание</Button>
                <Button type="primary" htmlType="submit" loading={submitting} disabled={!canSubmit}>
                  Создать ссылку на тест
                </Button>
              </Space>
            </Form>

            {formError ? (
              <Alert style={{ marginTop: 24 }} type="error" showIcon message={formError} />
            ) : null}

            {createdLink ? (
              <Alert
                style={{ marginTop: 24 }}
                type="success"
                showIcon
                message="Ссылка для сотрудника создана"
                description={
                  <Typography.Link href={createdLink} target="_blank">
                    {createdLink}
                  </Typography.Link>
                }
              />
            ) : null}
          </Card>

          <Card bordered={false} title="Список тестов и сессий">
            {sessionsError ? (
              <Alert style={{ marginBottom: 16 }} type="error" showIcon message={sessionsError} />
            ) : null}

            {loading ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <Spin size="large" />
              </div>
            ) : (
              <Table
                rowKey="id"
                dataSource={sessions}
                columns={tableColumns}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 1200 }}
              />
            )}
          </Card>
        </Space>
      </div>
    </Layout>
  );
}
