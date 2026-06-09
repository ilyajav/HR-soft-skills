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
import { clearAuth } from "../auth";
import { getHrCabinetLabel } from "../hrAccount";
import type {
  AssessmentCardDraft,
  AssessmentFormState,
  AssessmentProfile,
  CandidateSession,
  CreatedAssessmentResponse,
  TestTemplate,
} from "../types";

const METRIC_LABELS = {
  DSI: "Индекс скорости принятия решений",
  SRI: "Индекс стрессоустойчивости",
  TCEI: "Итоговый индекс эффективности",
} as const;

type MetricSelectionKey = "calc_dsi" | "calc_sri" | "calc_tcei";
type MetricCode = keyof typeof METRIC_LABELS;

const renderMetricColumnTitle = (metric: MetricCode) => (
  <span className="dashboard-metric-column-title">
    <span>{METRIC_LABELS[metric]}</span>
    <span className="dashboard-metric-column-title__code">{metric}</span>
  </span>
);

const DUPLICATE_TITLE_ERROR = "Тест с таким названием уже существует.";
const BASE_PROFILE_NAME = "Базовый профиль";

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

const getDefaultProfile = (profiles: AssessmentProfile[]): AssessmentProfile | null =>
  profiles.find((profile) => profile.name === BASE_PROFILE_NAME) ?? profiles[0] ?? null;

const buildProfileOptionLabel = (profile: AssessmentProfile): string =>
  `${profile.name}, версия ${profile.version}${profile.is_archived ? " (архивный)" : ""}`;

const buildTemplateCopyTitle = (templateTitle: string, templates: TestTemplate[]): string => {
  const normalizedExistingTitles = new Set(templates.map((template) => normalizeTitle(template.title)));
  const baseTitle = templateTitle.trim().replace(/\s+/g, " ") || "Копия теста";
  const firstCandidate = `${baseTitle} (копия)`;

  if (!normalizedExistingTitles.has(normalizeTitle(firstCandidate))) {
    return firstCandidate;
  }

  let copyNumber = 2;
  while (true) {
    const candidate = `${baseTitle} (копия ${copyNumber})`;
    if (!normalizedExistingTitles.has(normalizeTitle(candidate))) {
      return candidate;
    }
    copyNumber += 1;
  }
};

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
  const hrCabinetLabel = getHrCabinetLabel();
  const [sessions, setSessions] = useState<CandidateSession[]>([]);
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [createProfiles, setCreateProfiles] = useState<AssessmentProfile[]>([]);
  const [filterProfiles, setFilterProfiles] = useState<AssessmentProfile[]>([]);
  const [createdLink, setCreatedLink] = useState("");
  const [form, setForm] = useState<AssessmentFormState>(createEmptyForm);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedCreateProfileId, setSelectedCreateProfileId] = useState<number | null>(null);
  const [selectedFilterProfileId, setSelectedFilterProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [formError, setFormError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingTestId, setDeletingTestId] = useState<number | null>(null);

  const loadSessions = async ({
    profileId = selectedFilterProfileId,
    silent = false,
  }: {
    profileId?: number | null;
    silent?: boolean;
  } = {}): Promise<void> => {
    if (!profileId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await api.get<CandidateSession[]>("/hr/sessions/", {
        params: { profile_id: profileId },
      });
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

  const loadTemplates = async (): Promise<void> => {
    setTemplatesLoading(true);

    try {
      const response = await api.get<TestTemplate[]>("/hr/tests/");
      setTemplates(response.data);
    } catch {
      setFormError("Не удалось загрузить список тестов для шаблонов.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      const defaultProfileId = await loadProfiles();
      await Promise.all([loadSessions({ profileId: defaultProfileId }), loadTemplates()]);
    };

    void initializeDashboard();
  }, []);

  useEffect(() => {
    if (!selectedFilterProfileId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadSessions({ profileId: selectedFilterProfileId, silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [selectedFilterProfileId]);

  useEffect(() => {
    if (!titleError) {
      return;
    }

    setTitleError(hasDuplicateTitle(form.title) ? DUPLICATE_TITLE_ERROR : "");
  }, [sessions, form.title, titleError]);

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const loadProfiles = async (): Promise<number | null> => {
    setProfilesLoading(true);

    try {
      const [createResponse, filterResponse] = await Promise.all([
        api.get<AssessmentProfile[]>("/hr/assessment-profiles/", { params: { mode: "create" } }),
        api.get<AssessmentProfile[]>("/hr/assessment-profiles/", { params: { mode: "filter" } }),
      ]);

      setCreateProfiles(createResponse.data);
      setFilterProfiles(filterResponse.data);

      const nextCreateProfile = getDefaultProfile(createResponse.data);
      const nextFilterProfile = getDefaultProfile(filterResponse.data);
      const nextCreateProfileId = nextCreateProfile?.id ?? null;
      const nextFilterProfileId = nextFilterProfile?.id ?? null;

      setSelectedCreateProfileId((current) =>
        current && createResponse.data.some((profile) => profile.id === current)
          ? current
          : nextCreateProfileId,
      );
      setSelectedFilterProfileId((current) =>
        current && filterResponse.data.some((profile) => profile.id === current)
          ? current
          : nextFilterProfileId,
      );

      return nextFilterProfileId;
    } catch {
      setFormError("Не удалось загрузить профили оценки.");
      return null;
    } finally {
      setProfilesLoading(false);
    }
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

  const applyTemplate = (templateId: number | null) => {
    setSelectedTemplateId(templateId);
    setCreatedLink("");
    setFormError("");

    if (templateId === null) {
      return;
    }

    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setForm({
      title: buildTemplateCopyTitle(template.title, templates),
      calc_dsi: template.calc_dsi,
      calc_sri: template.calc_sri,
      calc_tcei: template.calc_tcei,
      cards: template.cards.map((card) => ({
        text: card.text,
        criticality_level: card.criticality_level,
      })),
    });
    setTitleError("");
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
    if (!selectedCreateProfileId) {
      setFormError("Выберите профиль оценки.");
      setSubmitting(false);
      return;
    }

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
        profile_id: selectedCreateProfileId,
        cards: form.cards.filter((card) => card.text.trim() !== ""),
        ...(selectedTemplateId ? { source_test_id: selectedTemplateId } : {}),
      };
      const response = await api.post<CreatedAssessmentResponse>("/hr/tests/", payload);
      setCreatedLink(`${window.location.origin}/play/${response.data.session_token}`);
      setForm(createEmptyForm());
      setSelectedTemplateId(null);
      setTitleError("");
      await loadSessions({ profileId: selectedFilterProfileId });
      await loadTemplates();
      await loadProfiles();
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
      if (selectedTemplateId === testId) {
        setSelectedTemplateId(null);
      }
      await loadSessions({ silent: true });
      await loadTemplates();
      await loadProfiles();
    } catch (error) {
      setSessionsError(getApiErrorMessage(error, "Не удалось удалить тест."));
    } finally {
      setDeletingTestId(null);
    }
  };

  const completedSessions = sessions.filter((session) => session.is_completed);
  const selectedCreateProfile =
    createProfiles.find((profile) => profile.id === selectedCreateProfileId) ?? null;
  const selectedFilterProfile =
    filterProfiles.find((profile) => profile.id === selectedFilterProfileId) ?? null;

  const tableColumns: TableProps<CandidateSession>["columns"] = [
    {
      title: "Тест",
      dataIndex: "test_title",
      key: "test_title",
      width: "9%",
    },
    {
      title: "Профиль",
      key: "profile",
      width: "11%",
      render: (_: unknown, session: CandidateSession) => (
        <Space size={[4, 8]} wrap>
          <Tag color={session.profile_is_archived ? "default" : "blue"}>
            {session.profile_name}, версия {session.profile_version}
          </Tag>
          {session.profile_is_archived ? <Tag>Архивный</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Сотрудник",
      dataIndex: "candidate_name",
      key: "candidate_name",
      width: "8%",
      render: (value: CandidateSession["candidate_name"]) => value || "Аноним",
    },
    {
      title: "Метрики",
      key: "metrics",
      width: "13%",
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
      width: "7%",
      render: (value: CandidateSession["is_completed"]) =>
        value ? <Tag color="success">Завершен</Tag> : <Tag color="processing">Открыт</Tag>,
    },
    {
      title: renderMetricColumnTitle("DSI"),
      dataIndex: "final_dsi",
      key: "final_dsi",
      width: "9%",
      align: "center",
      render: (value: CandidateSession["final_dsi"]) =>
        typeof value === "number" ? `${value.toFixed(2)}%` : "-",
    },
    {
      title: renderMetricColumnTitle("SRI"),
      dataIndex: "final_sri",
      key: "final_sri",
      width: "9%",
      align: "center",
      render: (value: CandidateSession["final_sri"]) =>
        typeof value === "number" ? `${value.toFixed(2)}%` : "-",
    },
    {
      title: renderMetricColumnTitle("TCEI"),
      dataIndex: "final_tcei",
      key: "final_tcei",
      width: "9%",
      align: "center",
      render: (value: CandidateSession["final_tcei"]) =>
        typeof value === "number" ? `${value.toFixed(2)}%` : "-",
    },
    {
      title: "Ссылка",
      key: "public_link",
      width: "9%",
      render: (_: unknown, session: CandidateSession) => (
        <Typography.Link href={`${window.location.origin}/play/${session.token}`} target="_blank">
          Открыть страницу тестирования
        </Typography.Link>
      ),
    },
    {
      title: "Результат",
      key: "results",
      width: "9%",
      render: (_: unknown, session: CandidateSession) =>
        session.is_completed ? (
          <Button
            type="link"
            onClick={() => navigate(`/results/${session.id}`)}
            style={{ paddingInline: 0, height: "auto", whiteSpace: "normal", textAlign: "left" }}
          >
            Открыть страницу результата
          </Button>
        ) : (
          <Typography.Text type="secondary">Нет данных</Typography.Text>
        ),
    },
    {
      title: "Действия",
      key: "actions",
      width: "7%",
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
            <Button
              danger
              type="link"
              loading={deletingTestId === session.test_id}
              style={{ paddingInline: 0, height: "auto", whiteSpace: "normal", textAlign: "left" }}
            >
              Удалить тест
            </Button>
          </Popconfirm>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
  ];

  const canSubmit = Boolean(
    selectedCreateProfileId &&
      form.title.trim() &&
      form.cards.some((card) => card.text.trim()) &&
      (form.calc_dsi || form.calc_sri || form.calc_tcei),
  );

  return (
    <Layout className="app-shell">
      <div className="page-section page-section--extra-wide">
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
                  Создание тестов и просмотр результатов
                </Typography.Title>
              </div>
              <Space wrap>
                <Button type="primary" onClick={() => navigate("/statistics")}>
                  Общая статистика
                </Button>
                <Button
                  onClick={() => {
                    void loadSessions();
                    void loadTemplates();
                    void loadProfiles();
                  }}
                >
                  Обновить
                </Button>
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
                <Form.Item label="Профиль оценки" required>
                  <Select
                    size="large"
                    loading={profilesLoading}
                    value={selectedCreateProfileId ?? undefined}
                    placeholder="Выберите профиль оценки"
                    options={createProfiles.map((profile) => ({
                      value: profile.id,
                      label: buildProfileOptionLabel(profile),
                    }))}
                    onChange={(value) => {
                      setSelectedCreateProfileId(value);
                      setCreatedLink("");
                    }}
                    notFoundContent={profilesLoading ? <Spin size="small" /> : "Нет активных профилей"}
                  />
                  {selectedCreateProfile ? (
                    <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                      {selectedCreateProfile.description || "Описание профиля не задано."} Версия{" "}
                      {selectedCreateProfile.version}.
                    </Typography.Paragraph>
                  ) : null}
                </Form.Item>

                <Form.Item label="Шаблон теста по уже созданным тестам">
                  <Select
                    size="large"
                    allowClear
                    showSearch
                    loading={templatesLoading}
                    value={selectedTemplateId ?? undefined}
                    placeholder="Выберите существующий тест как шаблон"
                    optionFilterProp="label"
                    options={templates.map((template) => ({
                      value: template.id,
                      label: template.title,
                    }))}
                    onChange={(value) => applyTemplate(value ?? null)}
                    notFoundContent={
                      templatesLoading ? <Spin size="small" /> : "Нет доступных шаблонов"
                    }
                  />
                </Form.Item>

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

          <Card bordered={false} title="Список тестов и сессий" className="dashboard-table-card">
            <Space direction="vertical" size={8} style={{ width: "100%", marginBottom: 16 }}>
              <Typography.Text strong>Показать тесты по профилю</Typography.Text>
              <Select
                style={{ width: "min(100%, 420px)" }}
                loading={profilesLoading}
                value={selectedFilterProfileId ?? undefined}
                options={filterProfiles.map((profile) => ({
                  value: profile.id,
                  label: buildProfileOptionLabel(profile),
                }))}
                onChange={(value) => {
                  setSelectedFilterProfileId(value);
                  void loadSessions({ profileId: value });
                }}
                notFoundContent={profilesLoading ? <Spin size="small" /> : "Нет доступных профилей"}
              />
              {selectedFilterProfile ? (
                <Typography.Text type="secondary">
                  Показаны тесты по профилю: {selectedFilterProfile.name}, версия{" "}
                  {selectedFilterProfile.version}
                  {selectedFilterProfile.is_archived ? " (архивный)" : ""}.
                </Typography.Text>
              ) : null}
            </Space>

            {sessionsError ? (
              <Alert style={{ marginBottom: 16 }} type="error" showIcon message={sessionsError} />
            ) : null}

            {loading ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <Spin size="large" />
              </div>
            ) : (
              <Table
                className="dashboard-sessions-table"
                rowKey="id"
                dataSource={sessions}
                columns={tableColumns}
                pagination={{ pageSize: 8 }}
                tableLayout="fixed"
              />
            )}
          </Card>
        </Space>
      </div>
    </Layout>
  );
}
