# RunTogether App

Единое Next.js-приложение для RunTogether. Оно отдает React-интерфейс и API routes из одного процесса.

## Локальный запуск без Docker

Требования:

- Node.js 24+
- npm
- PostgreSQL

Скопировать env:

```powershell
Copy-Item .env.example .env
```

Проверить подключение к базе в `.env`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sport_training
```

Создать базу:

```powershell
psql -U postgres -c "CREATE DATABASE sport_training;"
```

Установить зависимости:

```powershell
npm install
```

Применить схему и seed:

```powershell
npm run db:schema
npm run db:seed
```

Запустить dev-сервер:

```powershell
npm run dev
```

Адреса:

- приложение: http://localhost:4000
- API: http://localhost:4000/api
- healthcheck: http://localhost:4000/health

## Cron задачи
Сейчас выполняют очистку уведомлений старше N дней (настройка в панели админа)  
```powershell
npm run cron:loop
```

## Grafana, Loki, Promtail

Само приложение запускается локально, а инфраструктура логов запускается в Docker.

Логи приложения пишутся сюда:

```env
LOG_FILE=logs/app.log
```

Поднять Loki, Promtail и Grafana:

```powershell
npm run observability:up
```

Это использует `sport-app/docker-compose.yml` и не запускает приложение в контейнере.

Адреса:

- Grafana: http://localhost:3001
- Loki: http://localhost:3100

Вход в Grafana:

```text
Login: admin
Password: admin
```

Promtail читает `logs/*.log` и отправляет записи в Loki с label `service="sport-app"`.

Запрос в Grafana Explore:

```logql
{service="sport-app"}
```

Готовый dashboard: **Dashboards** -> **Sport App** -> **Sport App Logs**.

Остановить observability:

```powershell
npm run observability:down
```

## Тестовые пользователи

Администратор:

```text
Email: admin@sport.local
Password: Admin12345!
```

Пользователи:

```text
Email: alina@sport.local
Password: Admin12345!

Email: mark@sport.local
Password: Admin12345!
```

## Команды

```powershell
npm run dev            # dev-сервер Next.js
npm run build          # production-сборка
npm run start          # запуск production-сборки
npm run lint           # ESLint
npm run format:check   # проверка Prettier
npm run format         # форматирование
npm run db:schema      # применить src/db/schema.sql
npm run db:seed        # применить src/db/seed.sql
npm run db:studio      # Prisma Studio
npm run prisma:generate
```

## Пересоздать базу

```powershell
psql -U postgres -c "DROP DATABASE IF EXISTS sport_training;"
psql -U postgres -c "CREATE DATABASE sport_training;"
npm run db:schema
npm run db:seed
```

## Runtime

- `src/app` - App Router, layout, pages и API routes.
- `src/client` - React UI.
- `src/lib` - серверные сервисы, репозитории, auth, env, logging.
- `src/db` - SQL schema, seed и миграционные скрипты.
- `prisma/schema.prisma` - Prisma schema.
- `src/app/uploads/[...segments]` - прокси для аватарок из S3/MinIO.
- MinIO/S3 - хранилище загруженных аватарок.

## Логи

Приложение пишет структурированные Pino-логи в stdout и в файл из `LOG_FILE`.
По умолчанию:

```env
LOG_FILE=logs/app.log
```

## Production

Перед production-запуском обязательно заменить development-секреты в `.env`:

- `JWT_SECRET`
- `CRON_SECRET`
- `DATABASE_URL`

Сборка и запуск:

```powershell
npm run build
npm run start
```
