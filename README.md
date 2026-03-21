# HR-Tech MVP для оценки soft skills

MVP-платформа для оценки soft skills через игровой сценарий с Kanban-доской.
Фронтенд собирает телеметрию действий пользователя, а бэкенд рассчитывает метрики:

- `DSI` — индекс скорости принятия решений
- `SRI` — индекс стрессоустойчивости
- `TCEI` — итоговый индекс эффективности

## Стек

- Бэкенд: Django, Django REST Framework, Token Authentication
- База данных: PostgreSQL
- Фронтенд: React 18, Vite, @dnd-kit/core, axios, react-router-dom, Ant Design

## Структура проекта

```text
backend/
frontend/
```

## Запуск бэкенда

1. Создайте и активируйте виртуальное окружение.
2. Установите зависимости:

```bash
cd backend
pip install -r requirements.txt
```

3. При необходимости создайте `.env` на основе примера:

```bash
cp .env.example .env
```

4. Если хотите использовать PostgreSQL, заполните переменные:

```env
POSTGRES_DB=hr_assessment
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

5. Если `POSTGRES_DB` не задан, проект автоматически использует SQLite-файл `backend/db.sqlite3`.

6. Выполните миграции:

```bash
python manage.py makemigrations
python manage.py migrate
```

7. Запустите сервер:

```bash
python manage.py runserver
```

Базовый URL API:

```text
http://127.0.0.1:8000/api
```

## Запуск фронтенда

1. Установите зависимости:

```bash
cd frontend
npm install
```

2. Запустите dev-сервер:

```bash
npm run dev
```

Для Windows PowerShell, если `npm` упирается в policy, можно использовать:

```bash
npm.cmd run dev
```

Базовый URL фронтенда:

```text
http://127.0.0.1:5173
```

## Основные страницы

- `/login` — вход и регистрация HR
- `/dashboard` — кабинет HR: создание тестов, таблица тестов и управление ими
- `/results/:sessionId` — отдельная страница результата выбранной сессии
- `/play/:token` — публичная игровая сессия кандидата

## Основные API-методы

### Аутентификация

- `POST /api/auth/login/`
- `POST /api/auth/register/`

### Тесты HR

- `GET /api/hr/tests/`
- `POST /api/hr/tests/`
- `DELETE /api/hr/tests/<id>/`

### Сессии HR

- `GET /api/hr/sessions/`
- `GET /api/hr/sessions/<id>/`

### Публичное прохождение

- `GET /api/play/<uuid:token>/`
- `POST /api/play/<uuid:token>/submit/`

## Как работает сценарий

1. HR создает тест и набор карточек с уровнями критичности.
2. После создания теста автоматически генерируется одна публичная кандидатская сессия.
3. Кандидат открывает ссылку и распределяет задачи по колонкам критичности на Kanban-доске.
4. Фронтенд отправляет сырую телеметрию действий.
5. Бэкенд рассчитывает итоговые метрики и сохраняет результат.
6. HR открывает результат на отдельной странице.

## Особенности

- Фронтенд не рассчитывает итоговые метрики сам.
- Поле `criticality_level` намеренно скрыто в публичном `play`-endpoint.
- Таймер стресс-фактора показывается только для тестов, где включен `SRI`.
- В кабинете HR можно удалять тесты вместе со связанными карточками и сессиями.
- В интерфейсе есть переключатель светлого и темного режима.
