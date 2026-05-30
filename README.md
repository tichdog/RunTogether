# RunTogether

Веб-приложение для совместных тренировок.

Теперь проект собран как одно full-stack Next.js-приложение:

- `sport-app` - единое Next.js-приложение: React UI, App Router, API routes, PostgreSQL, Prisma, JWT в httpOnly cookie.
- Клиентский React-код находится в `sport-app/src/client`.
- Next-страницы и API находятся в `sport-app/src/app`.

## Быстрый запуск через Docker

Нужно установить только Docker Desktop. Node.js, npm, PostgreSQL, Prisma, Grafana и остальные зависимости локально ставить не нужно. Контейнеры используют Node.js 24.

Из корня проекта:

```powershell
docker compose up --build
```

После запуска будут доступны:

- приложение: http://localhost:4000
- API: http://localhost:4000/api
- healthcheck: http://localhost:4000/health
- Grafana: http://localhost:3001
- PostgreSQL: `localhost:5433`
- Loki: http://localhost:3100

Если порт приложения занят, его можно переопределить перед запуском:

```powershell
$env:APP_PORT = "4010"
$env:CLIENT_ORIGIN = "http://localhost:4010"
docker compose up --build
```

Grafana:

```text
Login: admin
Password: admin
```

PostgreSQL:

```text
Host: localhost
Port: 5433
Database: sport_training
User: postgres
Password: postgres
```

При первом запуске PostgreSQL автоматически применяет `sport-app/src/db/schema.sql` и `sport-app/src/db/seed.sql`.

## Тестовый вход

Администратор:

```text
Email: admin@sport.local
Password: Admin12345!
```

Обычные пользователи из seed:

```text
Email: alina@sport.local
Password: Admin12345!

Email: mark@sport.local
Password: Admin12345!
```

## Остановка

Остановить контейнеры:

```powershell
docker compose down
```

Остановить контейнеры и удалить данные PostgreSQL, Grafana и Loki:

```powershell
docker compose down -v
```

После `docker compose down -v` следующий запуск заново создаст базу и применит seed.

## Полезные команды

Пересобрать контейнеры:

```powershell
docker compose up --build
```

Посмотреть логи всех сервисов:

```powershell
docker compose logs -f
```

Посмотреть логи только приложения:

```powershell
docker compose logs -f app
```

Зайти в Prisma Studio:

```powershell
docker compose exec app npx prisma studio --hostname 0.0.0.0 --port 5555
```

После запуска Prisma Studio будет доступна на http://localhost:5555.

## Локальный запуск без Docker

Локальный запуск по-прежнему возможен, но для обычного старта проекта предпочтительнее Docker Compose.

```powershell
cd sport-app
Copy-Item .env.example .env
npm install
npm run dev
```

Инфраструктура отдельно:

```powershell
cd sport-app
docker compose --profile database up -d postgres
npm run observability:up
```
