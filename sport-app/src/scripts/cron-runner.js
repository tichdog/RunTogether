import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000
const DEFAULT_CRON_URL = 'http://localhost:4000/api/cron/workouts'

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const rawValue = trimmed.slice(separator + 1).trim()
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2')
    if (key && process.env[key] == null) {
      process.env[key] = value
    }
  }
}

function intervalMs() {
  const value = Number(process.env.CRON_INTERVAL_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INTERVAL_MS
}

async function runCronJobs() {
  const url = process.env.CRON_URL || DEFAULT_CRON_URL
  const response = await fetch(url, {
    method: 'POST',
    headers: process.env.CRON_SECRET
      ? {
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        }
      : {},
  })
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error || `Cron request failed with ${response.status}`)
  }

  return body
}

function logResult(result) {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      ...result,
    })
  )
}

async function runOnce() {
  loadDotEnv()
  logResult(await runCronJobs())
}

async function runLoop() {
  loadDotEnv()
  const delay = intervalMs()
  let running = false

  const tick = async () => {
    if (running) return
    running = true
    try {
      logResult(await runCronJobs())
    } catch (error) {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          ok: false,
          error: error.message,
        })
      )
    } finally {
      running = false
    }
  }

  await tick()
  setInterval(tick, delay)
}

if (process.argv.includes('--loop')) {
  runLoop()
} else {
  runOnce().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
