import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Input, Layout, Result, Row, Space, Spin, Typography } from "antd";
import { useParams } from "react-router-dom";
import api from "../api";
import type { PublicSession, PublicTaskCard, SubmitTelemetryResponse, TelemetryLog } from "../types";

const STRESS_COUNTDOWN_MS = 15000;
const STRESS_DANGER_THRESHOLD_MS = 5000;

const COLUMN_IDS = {
  incoming: "incoming",
  low: "low",
  medium: "medium",
  high: "high",
} as const;

type BoardColumnId = (typeof COLUMN_IDS)[keyof typeof COLUMN_IDS];

interface ColumnMeta {
  title: string;
  description: string;
  emptyText: string;
}

interface CardTelemetry {
  dragCount: number;
  firstDragAt: number | null;
}

type BoardState = Record<BoardColumnId, PublicTaskCard[]>;
type TelemetryState = Record<number, CardTelemetry>;
type AnswerColumnId = Exclude<BoardColumnId, typeof COLUMN_IDS.incoming>;

const COLUMN_ORDER: BoardColumnId[] = [
  COLUMN_IDS.incoming,
  COLUMN_IDS.low,
  COLUMN_IDS.medium,
  COLUMN_IDS.high,
];

const ANSWER_COLUMN_ORDER: AnswerColumnId[] = [
  COLUMN_IDS.low,
  COLUMN_IDS.medium,
  COLUMN_IDS.high,
];

const CRITICALITY_LEVEL_BY_COLUMN: Record<AnswerColumnId, number> = {
  [COLUMN_IDS.low]: 1,
  [COLUMN_IDS.medium]: 2,
  [COLUMN_IDS.high]: 3,
};

const COLUMN_META: Record<BoardColumnId, ColumnMeta> = {
  [COLUMN_IDS.incoming]: {
    title: "Входящие задачи",
    description: "Все карточки стартуют здесь и должны быть распределены по критичности.",
    emptyText: "Все входящие задачи уже распределены.",
  },
  [COLUMN_IDS.low]: {
    title: "Низкая критичность",
    description: "Задачи с минимальным риском и более мягким сроком реакции.",
    emptyText: "Перетащите сюда задачи низкой критичности.",
  },
  [COLUMN_IDS.medium]: {
    title: "Средняя критичность",
    description: "Задачи, которые важны, но не требуют самой резкой реакции.",
    emptyText: "Перетащите сюда задачи средней критичности.",
  },
  [COLUMN_IDS.high]: {
    title: "Высокая критичность",
    description: "Наиболее чувствительные задачи с высоким риском ошибки или задержки.",
    emptyText: "Перетащите сюда задачи высокой критичности.",
  },
};

const getCardDragId = (cardId: number) => `card-${cardId}`;
const getColumnDropId = (columnId: BoardColumnId) => `column-${columnId}`;

const isBoardColumnId = (value: unknown): value is BoardColumnId =>
  typeof value === "string" && COLUMN_ORDER.includes(value as BoardColumnId);

const formatCountdown = (timeLeftMs: number): string => {
  const totalSeconds = Math.ceil(timeLeftMs / 1000);
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const createBoardState = (cards: PublicTaskCard[] = []): BoardState => ({
  [COLUMN_IDS.incoming]: cards,
  [COLUMN_IDS.low]: [],
  [COLUMN_IDS.medium]: [],
  [COLUMN_IDS.high]: [],
});

const createTelemetryState = (cards: PublicTaskCard[] = []): TelemetryState =>
  cards.reduce<TelemetryState>((accumulator, card) => {
    accumulator[card.id] = {
      dragCount: 0,
      firstDragAt: null,
    };
    return accumulator;
  }, {});

const getCardId = (value: UniqueIdentifier): number => {
  const stringValue = String(value);

  if (stringValue.startsWith("card-")) {
    return Number(stringValue.slice(5));
  }

  return Number(stringValue);
};

const getTargetColumnId = (target: DragEndEvent["over"]): BoardColumnId | null => {
  const targetColumnId = target?.data.current?.columnId;
  if (isBoardColumnId(targetColumnId)) {
    return targetColumnId;
  }

  const targetId = String(target?.id ?? "");
  if (targetId.startsWith("column-")) {
    const parsedColumnId = targetId.slice(7);
    return isBoardColumnId(parsedColumnId) ? parsedColumnId : null;
  }

  return null;
};

const findCardColumnId = (board: BoardState, cardId: number): BoardColumnId | null =>
  COLUMN_ORDER.find((columnId) => board[columnId].some((card) => card.id === cardId)) ?? null;

const moveCardToColumn = (
  board: BoardState,
  cardId: number,
  targetColumnId: BoardColumnId,
): BoardState => {
  const sourceColumnId = findCardColumnId(board, cardId);
  if (!sourceColumnId || sourceColumnId === targetColumnId) {
    return board;
  }

  const movedCard = board[sourceColumnId].find((card) => card.id === cardId);
  if (!movedCard) {
    return board;
  }

  return {
    ...board,
    [sourceColumnId]: board[sourceColumnId].filter((card) => card.id !== cardId),
    [targetColumnId]: [...board[targetColumnId], movedCard],
  };
};

interface TaskCardProps {
  card: PublicTaskCard;
  columnId: BoardColumnId;
}

function TaskCard({ card, columnId }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: getCardDragId(card.id),
    data: {
      cardId: card.id,
      columnId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
      }}
      className="kanban-card-shell"
    >
      <Card
        className={`kanban-task-card ${isDragging ? "is-dragging" : ""}`}
        bordered={false}
        {...attributes}
        {...listeners}
      >
        <div className="kanban-task-card__content">
          <div className="kanban-task-card__handle">::</div>
          <Typography.Text strong>{card.text}</Typography.Text>
        </div>
      </Card>
    </div>
  );
}

interface KanbanColumnProps {
  columnId: BoardColumnId;
  cards: PublicTaskCard[];
}

function KanbanColumn({ columnId, cards }: KanbanColumnProps) {
  const { title, description, emptyText } = COLUMN_META[columnId];
  const { isOver, setNodeRef } = useDroppable({
    id: getColumnDropId(columnId),
    data: {
      columnId,
    },
  });

  return (
    <div ref={setNodeRef} className={`kanban-column kanban-column--${columnId} ${isOver ? "is-over" : ""}`}>
      <div className="kanban-column__header">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <div className="kanban-column__count">{cards.length}</div>
      </div>

      <div className="kanban-column__body">
        {cards.length ? (
          cards.map((card) => <TaskCard key={card.id} card={card} columnId={columnId} />)
        ) : (
          <div className="kanban-column__empty">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

export default function Play() {
  const { token } = useParams();
  const sensors = useSensors(useSensor(PointerSensor));
  const [sessionData, setSessionData] = useState<PublicSession | null>(null);
  const [board, setBoard] = useState<BoardState>(() => createBoardState());
  const [telemetry, setTelemetry] = useState<TelemetryState>({});
  const [candidateName, setCandidateName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stressTimerVisible, setStressTimerVisible] = useState(false);
  const [stressStartedAt, setStressStartedAt] = useState<number | null>(null);
  const [stressTimeLeftMs, setStressTimeLeftMs] = useState(STRESS_COUNTDOWN_MS);

  useEffect(() => {
    const loadGame = async () => {
      if (!token) {
        setError("Ссылка на тест некорректна.");
        setLoading(false);
        return;
      }

      try {
        const response = await api.get<PublicSession>(`/play/${token}/`);
        const cards = response.data.cards;

        setSessionData(response.data);
        setBoard(createBoardState(cards));
        setTelemetry(createTelemetryState(cards));
        setStressTimerVisible(false);
        setStressStartedAt(null);
        setStressTimeLeftMs(STRESS_COUNTDOWN_MS);
      } catch {
        setError("Не удалось загрузить тест.");
      } finally {
        setLoading(false);
      }
    };

    void loadGame();
  }, [token]);

  useEffect(() => {
    if (!stressTimerVisible || !stressStartedAt || submitted) {
      return undefined;
    }

    const tick = () => {
      const nextTimeLeftMs = Math.max(0, STRESS_COUNTDOWN_MS - (Date.now() - stressStartedAt));
      setStressTimeLeftMs(nextTimeLeftMs);
      return nextTimeLeftMs;
    };

    tick();
    const intervalId = window.setInterval(() => {
      const nextTimeLeftMs = tick();
      if (nextTimeLeftMs === 0) {
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [stressTimerVisible, stressStartedAt, submitted]);

  const revealStressTimer = () => {
    if (stressTimerVisible || !sessionData?.calc_sri) {
      return;
    }

    setStressTimerVisible(true);
    setStressStartedAt(Date.now());
    setStressTimeLeftMs(STRESS_COUNTDOWN_MS);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    revealStressTimer();

    const activeCardId = Number(active.data.current?.cardId ?? getCardId(active.id));
    if (!Number.isFinite(activeCardId)) {
      return;
    }

    setTelemetry((current) => {
      const existing = current[activeCardId] ?? { dragCount: 0, firstDragAt: null };
      if (existing.firstDragAt) {
        return current;
      }

      return {
        ...current,
        [activeCardId]: {
          ...existing,
          firstDragAt: Date.now(),
        },
      };
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) {
      return;
    }

    const activeCardId = Number(active.data.current?.cardId ?? getCardId(active.id));
    const activeColumnId = active.data.current?.columnId;
    const sourceColumnId = isBoardColumnId(activeColumnId)
      ? activeColumnId
      : findCardColumnId(board, activeCardId);
    const targetColumnId = getTargetColumnId(over);

    if (
      !Number.isFinite(activeCardId) ||
      !sourceColumnId ||
      !targetColumnId ||
      sourceColumnId === targetColumnId
    ) {
      return;
    }

    setBoard((current) => moveCardToColumn(current, activeCardId, targetColumnId));
    setTelemetry((current) => {
      const existing = current[activeCardId] ?? { dragCount: 0, firstDragAt: Date.now() };
      return {
        ...current,
        [activeCardId]: {
          ...existing,
          dragCount: existing.dragCount + 1,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!token) {
      setError("Ссылка на тест некорректна.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const finishedAt = Date.now();
      const logs: TelemetryLog[] = ANSWER_COLUMN_ORDER.flatMap((columnId) =>
        board[columnId].map((card) => {
          const itemTelemetry = telemetry[card.id] ?? {
            dragCount: 0,
            firstDragAt: finishedAt,
          };

          return {
            card_id: card.id,
            time_spent_ms: Math.max(0, finishedAt - (itemTelemetry.firstDragAt ?? finishedAt)),
            drag_count: itemTelemetry.dragCount,
            assigned_criticality_level: CRITICALITY_LEVEL_BY_COLUMN[columnId],
          };
        }),
      );

      await api.post<SubmitTelemetryResponse>(`/play/${token}/submit/`, {
        candidate_name: candidateName,
        logs,
      });
      setSubmitted(true);
    } catch {
      setError("Не удалось сохранить результат. Попробуйте еще раз.");
    } finally {
      setSubmitting(false);
    }
  };

  const incomingCards = board[COLUMN_IDS.incoming] ?? [];
  const canSubmit = incomingCards.length === 0;
  const shouldShowStressTimer = Boolean(sessionData?.calc_sri);
  const isStressDanger =
    shouldShowStressTimer && stressTimerVisible && stressTimeLeftMs <= STRESS_DANGER_THRESHOLD_MS;

  if (loading) {
    return (
      <div className="page-section page-section--narrow" style={{ justifyContent: "center" }}>
        <Card bordered={false} style={{ width: "100%", textAlign: "center" }}>
          <Space direction="vertical" size="middle">
            <Spin size="large" />
            <Typography.Text type="secondary">Загрузка теста...</Typography.Text>
          </Space>
        </Card>
      </div>
    );
  }

  if (error && !sessionData) {
    return (
      <div className="page-section page-section--narrow" style={{ justifyContent: "center" }}>
        <Alert type="error" showIcon message={error} style={{ width: "100%" }} />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page-section page-section--narrow" style={{ justifyContent: "center" }}>
        <Card bordered={false} style={{ width: "100%" }}>
          <Result
            status="success"
            title="Спасибо!"
            subTitle="Результат успешно сохранен и отправлен."
          />
        </Card>
      </div>
    );
  }

  if (!sessionData) {
    return null;
  }

  if (sessionData.is_completed) {
    return (
      <div className="page-section page-section--narrow" style={{ justifyContent: "center" }}>
        <Card bordered={false} style={{ width: "100%" }}>
          <Result
            status="warning"
            title="Тест уже завершен"
            subTitle="Эта ссылка уже была использована."
          />
        </Card>
      </div>
    );
  }

  return (
    <Layout className="app-shell">
      {shouldShowStressTimer && stressTimerVisible ? (
        <div className={`stress-timer ${isStressDanger ? "is-danger" : ""}`}>
          <span className="stress-timer__label">До окончания тестирования осталось:</span>
          <span className="stress-timer__value">{formatCountdown(stressTimeLeftMs)}</span>
        </div>
      ) : null}

      <div className="page-section">
        <Space direction="vertical" size={24} className="play-stack" style={{ width: "100%" }}>
          <Card bordered={false}>
            <Typography.Paragraph type="secondary" className="priority-hint">
              Распределите все карточки из колонки "Входящие задачи" по колонкам низкой, средней и
              высокой критичности. Кнопка отправки станет активной только после полной
              сортировки.
            </Typography.Paragraph>

            <div style={{ maxWidth: 420 }}>
              <Typography.Text strong>Имя сотрудника</Typography.Text>
              <Input
                size="large"
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                placeholder="Необязательно"
                style={{ marginTop: 8 }}
              />
            </div>
          </Card>

          <Card bordered={false} title="Kanban-доска критичности">
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Row gutter={[16, 16]}>
                {COLUMN_ORDER.map((columnId) => (
                  <Col xs={24} md={12} xl={6} key={columnId}>
                    <KanbanColumn columnId={columnId} cards={board[columnId]} />
                  </Col>
                ))}
              </Row>
            </DndContext>
          </Card>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <div className="play-actions">
            <Space direction="vertical" align="end" size={8}>
              {!canSubmit ? (
                <Typography.Text type="secondary">
                  Сначала распределите все карточки из колонки "Входящие задачи".
                </Typography.Text>
              ) : null}
              <Button
                type="primary"
                size="large"
                onClick={() => void handleSave()}
                loading={submitting}
                disabled={!canSubmit}
              >
                Отправить
              </Button>
            </Space>
          </div>
        </Space>
      </div>
    </Layout>
  );
}
