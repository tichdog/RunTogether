FROM node:24-bookworm-slim

WORKDIR /app

ENV DATABASE_URL=postgres://postgres:postgres@postgres:5432/sport_training
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 \
      --fetch-timeout=600000

COPY . .
RUN npm run prisma:generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
