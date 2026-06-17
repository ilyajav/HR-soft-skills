# MVP для оценки soft skills

MVP-платформа для оценки soft skills сотрудников через игровой сценарий с Kanban-доской.
Фронтенд собирает телеметрию действий кандидата, а бэкенд рассчитывает метрики:

- `DSI` — индекс скорости принятия решений;
- `SRI` — индекс стрессоустойчивости;
- `TCEI` — итоговый индекс эффективности.

В системе есть три пользовательские роли:

- `admin` — администратор системы, создаётся через `createsuperuser`;
- `hr` — HR-пользователь, создаётся администратором в панели управления;
- `candindate` — кандидат (сотрудник), проходит тест по публичной ссылке без аккаунта.

Кандидат не имеет аккаунта и проходит тест только по публичной ссылке.

## Стек

- Бэкенд: Django, Django REST Framework, Token Authentication
- База данных: PostgreSQL
- Фронтенд: React 18, TypeScript, Vite, Ant Design, @dnd-kit/core, axios, react-router-dom

## Структура проекта

```text
backend/   Django + DRF API
frontend/  React + Vite UI
```

## Запуск бэкенда

1. Создайте и активируйте виртуальное окружение.

2. Установите зависимости:

```bash
cd backend
pip install -r requirements.txt
```

3. Cоздайте `.env` на основе шаблона:

```bash
cp .env.example .env
```

4. Для PostgreSQL заполните переменные:

```env
POSTGRES_DB=hr_assessment
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

5. Выполните миграции:

```bash
python manage.py migrate
```

6. Создайте администратора:

```bash
python manage.py createsuperuser
```

Далее нужно ввести логин и пароль для учетной записи администратора

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

Базовый URL фронтенда:

```text
http://127.0.0.1:5173
```

## Основные страницы

- `/login` — вход по `username + password`;
- `/admin` — панель администратора;
- `/admin/hr-users` — управление HR-пользователями;
- `/admin/assessment-profiles` — управление профилями оценки;
- `/dashboard` — HR-кабинет: создание тестов, выбор профиля, таблица тестов;
- `/statistics` — общая аналитика HR с фильтром по профилю оценки;
- `/results/:sessionId` — результат конкретной кандидатской сессии;
- `/play/:token` — публичное прохождение теста кандидатом.

Публичная регистрация HR в интерфейсе отключена.

## Роли и доступ

Администратор:

- определяется через `is_superuser = true`;
- создаёт HR-пользователей;
- отключает HR-пользователей через `is_active = false`;
- создаёт, редактирует и архивирует профили оценки.

HR-пользователь:

- определяется через `is_superuser = false`;
- входит по `username + password`;
- создаёт тесты и выбирает профиль оценки;
- просматривает тесты, результаты и статистику только в рамках своих данных;
- не может управлять HR-пользователями и профилями оценки.

Отключённый HR не может войти в систему.

## Профили оценки

Профиль оценки задаёт параметры формул DSI/SRI/TCEI:

- веса низкой, средней и высокой критичности;
- максимальное время для каждого уровня критичности;
- максимум перемещений для SRI;
- минимальное время для DSI.

После миграций автоматически создаётся профиль:

```text
Базовый профиль, версия 1
```

Его параметры повторяют текущую базовую математику:

- `low_criticality_weight = 0.5`
- `medium_criticality_weight = 1.0`
- `high_criticality_weight = 1.5`
- `low_criticality_max_time_ms = 30000`
- `medium_criticality_max_time_ms = 15000`
- `high_criticality_max_time_ms = 10000`
- `sri_max_drag_count = 4`
- `min_time_ms = 2000`

При создании теста параметры выбранного профиля сохраняются в snapshot внутри `TestConfig`.
Расчёт использует snapshot, а не текущие значения профиля. Поэтому старые результаты не меняются при редактировании или архивировании профиля.

Если профиль уже использовался в тестах, параметры формул напрямую менять нельзя. Можно изменить только название, описание и активность. При удалении использованный профиль архивируется, а старые тесты и аналитика остаются доступными.

## Основные API-методы

### Аутентификация

- `POST /api/auth/login/`

 HR-пользователи создаются только администратором через административный API.

### Admin: HR-пользователи

- `GET /api/admin/hr-users/`
- `POST /api/admin/hr-users/`
- `DELETE /api/admin/hr-users/<id>/`

`DELETE` выполняет безопасную деактивацию HR-пользователя и не удаляет его тесты или результаты.

### Admin: профили оценки

- `GET /api/admin/assessment-profiles/`
- `POST /api/admin/assessment-profiles/`
- `GET /api/admin/assessment-profiles/<id>/`
- `PATCH /api/admin/assessment-profiles/<id>/`
- `DELETE /api/admin/assessment-profiles/<id>/`

### HR: профили оценки

- `GET /api/hr/assessment-profiles/?mode=create` — активные неархивные профили для создания теста;
- `GET /api/hr/assessment-profiles/?mode=filter` — профили для фильтров, включая архивные профили с тестами текущего HR.

### HR: тесты и сессии

- `GET /api/hr/tests/`
- `POST /api/hr/tests/`
- `DELETE /api/hr/tests/<id>/`
- `GET /api/hr/sessions/?profile_id=<id>`
- `GET /api/hr/sessions/<id>/`
- `GET /api/hr/statistics/?profile_id=<id>`

### Публичное прохождение

- `GET /api/play/<uuid:token>/`
- `POST /api/play/<uuid:token>/submit/`

## Как работает сценарий

1. Администратор создаёт HR-пользователя и, при необходимости, профили оценки.
2. HR входит в кабинет, выбирает профиль оценки и создаёт тест с карточками заданий.
3. При создании теста backend сохраняет snapshot параметров выбранного профиля.
4. Для теста автоматически создаётся публичная кандидатская сессия.
5. Кандидат открывает ссылку `/play/:token` и распределяет задачи по критичности.
6. Фронтенд отправляет сырую телеметрию.
7. Бэкенд рассчитывает DSI, SRI и TCEI по snapshot параметров теста.
8. HR смотрит результаты и аналитику с фильтрацией по профилю оценки.

## Проверки

Backend:

```bash
cd backend
python manage.py check
python manage.py test
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```
