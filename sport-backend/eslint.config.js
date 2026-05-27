import js from '@eslint/js'
import globals from 'globals'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '.next',
    'out',
    'build',
    'coverage',
    'uploads',
    'public/uploads',
    'src/generated/prisma',
  ]),
  js.configs.recommended,
  ...nextVitals,
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  prettier,
])
