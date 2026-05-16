# RunTogether

Веб-приложение для совместных тренировок.

Проект состоит из двух частей:

- `sport-backend` — Next.js API, PostgreSQL, JWT в httpOnly cookie.
- `sport-frontend` — React frontend для админки и клиентского интерфейса.

## Требования

- Node.js 20+
- npm
- Docker Desktop для PostgreSQL
- PgAdmin, если удобно смотреть БД через интерфейс

## Быстрый запуск

### 1. Запустить PostgreSQL

Открой Docker Desktop и дождись, пока он полностью запустится.

Затем:

```powershell
cd C:\Users\CrazyRabbit\Documents\Web\sport-backend
docker compose up -d
```

PostgreSQL будет доступен на порту `5433`.

Данные БД:

```text
Host: localhost
Port: 5433
Database: sport_training
User: postgres
Password: postgres
```

### 2. Настроить backend

```powershell
cd C:\Users\CrazyRabbit\Documents\Web\sport-backend
Copy-Item .env.example .env
npm install
npm run dev
```

Backend запустится на:

```text
http://localhost:4000
```

Проверка:

```powershell
Invoke-WebRequest http://localhost:4000/health
```

### 3. Запустить frontend

```powershell
cd C:\Users\CrazyRabbit\Documents\Web\sport-frontend
npm install
npm run dev
```

Vite покажет адрес в терминале. Обычно это:

```text
http://localhost:5173
```

Если `5173` занят, Vite может открыть, например:

```text
http://localhost:5174
```

## Тестовый вход

После первого запуска Docker-БД автоматически применяются `schema.sql` и `seed.sql`.

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

Администратор попадает в админ-панель. Обычные пользователи попадают в клиентский интерфейс.

## PgAdmin

Чтобы смотреть таблицы через PgAdmin:

1. Открой PgAdmin.
2. Нажми `Register -> Server`.
3. Во вкладке `General` укажи имя, например `RunTogether`.
4. Во вкладке `Connection` укажи:

```text
Host name/address: localhost
Port: 5433
Maintenance database: sport_training
Username: postgres
Password: postgres
```

После подключения таблицы лежат в:

```text
Servers -> RunTogether -> Databases -> sport_training -> Schemas -> public -> Tables
```

## Если БД нужно пересоздать

Команда удалит текущие данные и заново применит схему и seed:

```powershell
cd C:\Users\CrazyRabbit\Documents\Web\sport-backend
docker compose down -v
docker compose up -d
```

## Полезные команды

Backend:

```powershell
cd C:\Users\CrazyRabbit\Documents\Web\sport-backend
npm run dev
npm run check
```

Frontend:

```powershell
cd C:\Users\CrazyRabbit\Documents\Web\sport-frontend
npm run dev
npm run build
```

## Что не загружать в Git

В репозитории не нужны:

- `node_modules`
- `.env`
- `dist`
- логи
- загруженные файлы из `uploads`

Это уже учтено в `.gitignore`.
