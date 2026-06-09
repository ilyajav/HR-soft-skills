import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Layout,
  Modal,
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
import type { AssessmentProfile, AssessmentProfilePayload } from "../types";

const BASE_PROFILE_NAME = "Базовый профиль";

const createEmptyForm = (): AssessmentProfilePayload => ({
  name: "",
  description: "",
  version: 1,
  is_active: true,
  low_criticality_weight: 0.5,
  medium_criticality_weight: 1,
  high_criticality_weight: 1.5,
  low_criticality_max_time_ms: 30000,
  medium_criticality_max_time_ms: 15000,
  high_criticality_max_time_ms: 10000,
  sri_max_drag_count: 4,
  min_time_ms: 2000,
});

const createFormFromProfile = (profile: AssessmentProfile): AssessmentProfilePayload => ({
  name: profile.name,
  description: profile.description,
  version: profile.version,
  is_active: profile.is_active,
  low_criticality_weight: profile.low_criticality_weight,
  medium_criticality_weight: profile.medium_criticality_weight,
  high_criticality_weight: profile.high_criticality_weight,
  low_criticality_max_time_ms: profile.low_criticality_max_time_ms,
  medium_criticality_max_time_ms: profile.medium_criticality_max_time_ms,
  high_criticality_max_time_ms: profile.high_criticality_max_time_ms,
  sri_max_drag_count: profile.sri_max_drag_count,
  min_time_ms: profile.min_time_ms,
});

const formatDateTime = (value?: string): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatProfileParams = (profile: AssessmentProfile): string =>
  `веса ${profile.low_criticality_weight}/${profile.medium_criticality_weight}/${profile.high_criticality_weight}; ` +
  `время ${profile.low_criticality_max_time_ms}/${profile.medium_criticality_max_time_ms}/${profile.high_criticality_max_time_ms} мс; ` +
  `SRI ${profile.sri_max_drag_count}; DSI мин ${profile.min_time_ms} мс`;

export default function AdminAssessmentProfiles() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<AssessmentProfile[]>([]);
  const [form, setForm] = useState<AssessmentProfilePayload>(createEmptyForm);
  const [editingProfile, setEditingProfile] = useState<AssessmentProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProfiles = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<AssessmentProfile[]>("/admin/assessment-profiles/");
      setProfiles(response.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Не удалось загрузить профили оценки."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfiles();
  }, []);

  const logout = () => {
    clearAuth();
    navigate("/login");
  };

  const openCreateModal = () => {
    setEditingProfile(null);
    setForm(createEmptyForm());
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (profile: AssessmentProfile) => {
    setEditingProfile(profile);
    setForm(createFormFromProfile(profile));
    setFormError("");
    setIsModalOpen(true);
  };

  const validateForm = (): string => {
    if (!form.name.trim()) {
      return "Введите название профиля";
    }

    if (form.version <= 0) {
      return "Версия должна быть положительным числом.";
    }

    const weightValues = [
      form.low_criticality_weight,
      form.medium_criticality_weight,
      form.high_criticality_weight,
    ];

    if (weightValues.some((value) => value <= 0)) {
      return "Вес должен быть положительным числом";
    }

    const timeValues = [
      form.low_criticality_max_time_ms,
      form.medium_criticality_max_time_ms,
      form.high_criticality_max_time_ms,
      form.min_time_ms,
    ];

    if (timeValues.some((value) => value <= 0)) {
      return "Время должно быть положительным числом";
    }

    if (form.sri_max_drag_count <= 0 || !Number.isInteger(form.sri_max_drag_count)) {
      return "Количество перемещений должно быть положительным целым числом";
    }

    return "";
  };

  const saveProfile = async () => {
    const validationError = validateForm();
    setFormError(validationError);
    setSuccessMessage("");

    if (validationError) {
      return;
    }

    setSaving(true);

    try {
      const payload = { ...form, name: form.name.trim() };
      const response = editingProfile
        ? await api.patch<AssessmentProfile>(`/admin/assessment-profiles/${editingProfile.id}/`, payload)
        : await api.post<AssessmentProfile>("/admin/assessment-profiles/", payload);

      setSuccessMessage(
        editingProfile
          ? `Профиль ${response.data.name} обновлён.`
          : `Профиль ${response.data.name} создан.`,
      );
      setIsModalOpen(false);
      await loadProfiles();
    } catch (saveError) {
      setFormError(getApiErrorMessage(saveError, "Не удалось сохранить профиль оценки."));
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (profile: AssessmentProfile) => {
    setDeletingId(profile.id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await api.delete<AssessmentProfile>(`/admin/assessment-profiles/${profile.id}/`);
      setSuccessMessage(
        response.status === 204
          ? "Профиль удалён."
          : "Профиль архивирован. Старые тесты и результаты сохранены.",
      );
      await loadProfiles();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, "Не удалось удалить или архивировать профиль."));
    } finally {
      setDeletingId(null);
    }
  };

  const updateFormValue = <K extends keyof AssessmentProfilePayload>(
    key: K,
    value: AssessmentProfilePayload[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const parametersLocked = Boolean(editingProfile?.is_used);
  const isEditingBaseProfile = Boolean(
    editingProfile && editingProfile.name === BASE_PROFILE_NAME && editingProfile.version === 1,
  );

  const columns: TableProps<AssessmentProfile>["columns"] = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 64,
    },
    {
      title: "Название",
      dataIndex: "name",
      key: "name",
      width: 190,
      ellipsis: true,
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      width: 220,
      ellipsis: true,
      render: (value: AssessmentProfile["description"]) => value || "-",
    },
    {
      title: "Версия",
      dataIndex: "version",
      key: "version",
      width: 80,
    },
    {
      title: "Статус",
      key: "status",
      width: 130,
      render: (_: unknown, profile) =>
        profile.is_archived ? (
          <Tag>Архивный</Tag>
        ) : profile.is_active ? (
          <Tag color="success">Активен</Tag>
        ) : (
          <Tag color="warning">Неактивен</Tag>
        ),
    },
    {
      title: "Параметры",
      key: "params",
      width: 320,
      render: (_: unknown, profile) => (
        <Typography.Text style={{ whiteSpace: "normal" }}>
          {formatProfileParams(profile)}
        </Typography.Text>
      ),
    },
    {
      title: "Обновлён",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 160,
      render: (value: AssessmentProfile["updated_at"]) => formatDateTime(value),
    },
    {
      title: "Действия",
      key: "actions",
      width: 180,
      render: (_: unknown, profile) => (
        <Space wrap>
          <Button type="link" onClick={() => openEditModal(profile)} style={{ paddingInline: 0 }}>
            Редактировать
          </Button>
          <Popconfirm
            title="Удалить профиль?"
            description="Если профиль уже использовался в тестах, он будет архивирован. Старые тесты и результаты сохранятся."
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true, loading: deletingId === profile.id }}
            onConfirm={() => deleteProfile(profile)}
          >
            <Button
              danger
              type="link"
              disabled={profile.name === BASE_PROFILE_NAME && profile.version === 1}
              loading={deletingId === profile.id}
              style={{ paddingInline: 0 }}
            >
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout className="app-shell">
      <div className="page-section page-section--wide">
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
                  Профили оценки
                </Typography.Title>
              </div>
              <Space wrap>
                <Button type="primary" onClick={openCreateModal}>
                  Создать профиль
                </Button>
                <Button onClick={() => navigate(ADMIN_HOME_PATH)}>Назад</Button>
                <Button onClick={logout}>Выйти</Button>
              </Space>
            </Space>
          </Card>

          {successMessage ? <Alert type="success" showIcon message={successMessage} /> : null}
          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Card bordered={false} title="Список профилей">
            {loading ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <Spin size="large" />
              </div>
            ) : (
              <Table
                rowKey="id"
                dataSource={profiles}
                columns={columns}
                pagination={{ pageSize: 8 }}
              />
            )}
          </Card>
        </Space>

        <Modal
          title={editingProfile ? "Редактировать профиль" : "Создать профиль"}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          onOk={saveProfile}
          okText={editingProfile ? "Сохранить" : "Создать"}
          cancelText="Отмена"
          confirmLoading={saving}
          width={760}
        >
          <Form layout="vertical" requiredMark={false}>
            <Form.Item label="Название" required>
              <Input
                value={form.name}
                onChange={(event) => updateFormValue("name", event.target.value)}
              />
            </Form.Item>

            <Form.Item label="Описание">
              <Input.TextArea
                rows={3}
                value={form.description}
                onChange={(event) => updateFormValue("description", event.target.value)}
              />
            </Form.Item>

            <div className="dashboard-form-grid">
              <Form.Item label="Версия" required>
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                  value={form.version}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("version", value ?? 1)}
                />
              </Form.Item>

              <Form.Item
                extra="Если отключить параметр, профиль нельзя будет выбрать при создании нового теста. Старые тесты и результаты, созданные с этим профилем, сохранятся."
              >
                <Checkbox
                  checked={form.is_active}
                  disabled={editingProfile?.is_archived || isEditingBaseProfile}
                  onChange={(event) => updateFormValue("is_active", event.target.checked)}
                >
                  Доступен для новых тестов
                </Checkbox>
              </Form.Item>
            </div>

            <div className="dashboard-form-grid">
              <Form.Item label="Вес карточки низкой критичности" required>
                <InputNumber
                  min={0.01}
                  step={0.1}
                  style={{ width: "100%" }}
                  value={form.low_criticality_weight}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("low_criticality_weight", value ?? 0)}
                />
              </Form.Item>
              <Form.Item label="Вес карточки средней критичности" required>
                <InputNumber
                  min={0.01}
                  step={0.1}
                  style={{ width: "100%" }}
                  value={form.medium_criticality_weight}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("medium_criticality_weight", value ?? 0)}
                />
              </Form.Item>
              <Form.Item label="Вес карточки высокой критичности" required>
                <InputNumber
                  min={0.01}
                  step={0.1}
                  style={{ width: "100%" }}
                  value={form.high_criticality_weight}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("high_criticality_weight", value ?? 0)}
                />
              </Form.Item>
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: -12, marginBottom: 24 }}>
              Вес определяет вклад карточки соответствующей критичности в итоговый индекс.
            </Typography.Paragraph>

            <div className="dashboard-form-grid">
              <Form.Item label="Максимальное время для низкой критичности, мс" required>
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                  value={form.low_criticality_max_time_ms}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("low_criticality_max_time_ms", value ?? 0)}
                />
              </Form.Item>
              <Form.Item label="Максимальное время для средней критичности, мс" required>
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                  value={form.medium_criticality_max_time_ms}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("medium_criticality_max_time_ms", value ?? 0)}
                />
              </Form.Item>
              <Form.Item label="Максимальное время для высокой критичности, мс" required>
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                  value={form.high_criticality_max_time_ms}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("high_criticality_max_time_ms", value ?? 0)}
                />
              </Form.Item>
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: -12, marginBottom: 24 }}>
              Максимальное время используется как верхняя граница нормализации DSI. При превышении этого
              значения вклад карточки в индекс скорости становится минимальным.
            </Typography.Paragraph>

            <div className="dashboard-form-grid">
              <Form.Item
                label="Максимальное количество перемещений для SRI"
                required
                extra="Параметр задаёт порог, после которого повторные перемещения карточки интерпретируются как выраженная нестабильность решения."
              >
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                  value={form.sri_max_drag_count}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("sri_max_drag_count", value ?? 0)}
                />
              </Form.Item>
              <Form.Item
                label="Нижняя граница времени для DSI, мс"
                required
                extra="Если время взаимодействия с карточкой меньше или равно этому значению, скорость выполнения считается максимальной."
              >
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                  value={form.min_time_ms}
                  disabled={parametersLocked}
                  onChange={(value) => updateFormValue("min_time_ms", value ?? 0)}
                />
              </Form.Item>
            </div>

            {parametersLocked ? (
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message="Профиль уже использовался в тестах. Можно изменить только название, описание и активность."
              />
            ) : null}

            {formError ? <Alert type="error" showIcon message={formError} /> : null}
          </Form>
        </Modal>
      </div>
    </Layout>
  );
}
