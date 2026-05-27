# RunTogether

Веб-приложение для совместных тренировок.

Проект состоит из двух частей:

- `sport-backend` — Next.js API, PostgreSQL, JWT в httpOnly cookie.
- `sport-frontend` — React frontend для админки и клиентского интерфейса.

## Требования

- Node.js 20+
- npm
- Docker Desktop для PostgreSQL, grafana, loki, promtail
- PgAdmin, если удобно смотреть БД через интерфейс

## Быстрый запуск

### 1. Запустить PostgreSQL (через docker контейнер)

Открыть Docker Desktop и дождаться, пока он полностью запустится.

Затем: зайти в папку sport-backend и выполнить

```powershell
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

### 1.2 Если запуск через PgAdmin

Создать в PgAdmin новую базу данных, и выполнить 2 SQL файла которые лежат в папке бэка.
Там находятся запросы для создания таблиц и дефолтных значений.  
В .env файле укажите имя БД и пароль, а так же порт на котором запущена Бд (обычно 5432)

### 1.3 Запуск docker контейнера для логгера 
```powershell
  docker compose up -d
```

### 2. Настроить backend

```powershell
cd ...\Web\sport-backend
Copy-Item .env.example .env
npm install
npm run dev
```

Backend запустится на:

```text
http://localhost:4000
```

### 3. Запустить frontend

```powershell
cd ...\Web\sport-frontend
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

(Если БД была запущена в контейнере)
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


## Если БД нужно пересоздать

Команда удалит текущие данные и заново применит схему и seed:

```powershell
cd ...\Web\sport-backend
docker compose down -v
docker compose up -d
```

