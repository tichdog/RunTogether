# Инструменты качества кода

В проекте используются ESLint для статического анализа и Prettier для форматирования.

## Единое Next.js-приложение

```powershell
cd sport-app
npm run lint
npm run lint:fix
npm run format:check
npm run format
npm run build
```

ESLint проверяет правила качества для React, React Hooks и Next.js.
Prettier отвечает за форматирование, а `eslint-config-prettier` отключает
правила ESLint, которые могли бы конфликтовать с Prettier.

Скрипты форматирования намеренно проверяют исходники и конфигурационные файлы,
но не generated build output.
