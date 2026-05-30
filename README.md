# RunTogether

Веб-приложение для совместных тренировок.

Проект собран как одно full-stack Next.js-приложение:

- `sport-app` - React UI, Next.js App Router, API routes, Prisma и PostgreSQL.
- Клиентский код: `sport-app/src/client`.
- Страницы и API: `sport-app/src/app`.
- Серверная логика: `sport-app/src/lib`.

## Что нужно установить

- Node.js 24 или новее.
- npm.
- PostgreSQL 17 или совместимую версию.


## Первый запуск

Открыть консоль из корня проекта:

```powershell
cd sport-app
Copy-Item .env.example .env
```

Проверь `DATABASE_URL` в файле `sport-app/.env`.
Для локального PostgreSQL обычно подходит:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sport_training
```

Если у PostgreSQL другой пароль, пользователь или порт, поправь строку под свою установку.

Создай базу данных:

```powershell
psql -U postgres -c "CREATE DATABASE sport_training;"
```

Установи зависимости:

```powershell
npm install
```

Примени схему и seed-данные:

```powershell
npm run db:schema
npm run db:seed
```

Запусти приложение:

```powershell
npm run dev
```

После запуска:

- приложение: http://localhost:4000
- API: http://localhost:4000/api
- healthcheck: http://localhost:4000/health

## Логи, Grafana и Loki

Приложение пишет Pino-логи в консоль и в файл:

```text
sport-app/logs/app.log
```

Чтобы смотреть эти логи в Grafana, Loki, Promtail и Grafana подять через Docker:

```powershell
docker compose up -d 
```

После запуска будут доступны:

- Grafana: http://localhost:3001
- Loki: http://localhost:3100

Вход в Grafana:

```text
Login: admin
Password: admin
```

Promtail читает локальные файлы из `sport-app/logs/*.log` и отправляет их в Loki. В Grafana открой **Explore**, выбери **Loki** и выполни запрос:

Полезные запросы:

```logql
{service="sport-app"} |= "Request completed"
```

```logql
{service="sport-app", status=~"5.."}
```

Готовый dashboard лежит в Grafana в разделе **Dashboards** -> **Sport App** -> **Sport App Logs**.

Остановить observability-контейнеры:

```powershell
docker compose down
```

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

## Полезные команды

Проверить сборку:

```powershell
npm run build
```

Запустить production-сборку:

```powershell
npm run build
npm run start
```

Проверить код:

```powershell
npm run lint
npm run format:check
```

Автоформатирование:

```powershell
npm run format
```

Открыть Prisma Studio:

```powershell
npm run db:studio
```

Перегенерировать Prisma Client:

```powershell
npm run prisma:generate
```

## Если база уже была создана

Если нужно пересоздать локальную базу с нуля:

```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS sport_training;"
psql -U postgres -c "CREATE DATABASE sport_training;"
npm run db:schema
npm run db:seed
```

## Переменные окружения

Основные переменные лежат в `sport-app/.env`.

Самые важные:

- `DATABASE_URL` - подключение к PostgreSQL.
- `JWT_SECRET` - секрет для JWT.
- `CRON_SECRET` - секрет для cron endpoint.
- `CLIENT_ORIGIN` - адрес приложения, обычно `http://localhost:4000`.
- `UPLOAD_DIR` - папка для загруженных файлов, по умолчанию `public/uploads`.

Для локальной разработки dummy-ключи Turnstile уже прописаны в `.env.example`.

## Структура

```text
sport-app/
  src/app/          Next.js pages, layouts и API routes
  src/client/       React-интерфейс
  src/lib/          серверные сервисы, репозитории, auth, env
  src/db/           SQL schema, seed и миграционные скрипты
  prisma/           Prisma schema
  public/           статические файлы и uploads
```
