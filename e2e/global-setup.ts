import { chromium, type FullConfig } from '@playwright/test'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const authDir = path.join(process.cwd(), 'test-results', '.auth')
const user1State = path.join(authDir, 'user1.json')
const user2State = path.join(authDir, 'user2.json')

async function saveLoginState(baseURL: string, email: string, password: string, statePath: string) {
  const browser = await chromium.launch({ channel: 'chrome' })
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  try {
    await page.goto('/auth/login')
    await page.getByLabel('이메일').fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.getByRole('button', { name: '로그인' }).click()
    await page.waitForURL(/\/workspaces|\/w\//, { timeout: 15_000 })
    await context.storageState({ path: statePath })
  } finally {
    await browser.close()
  }
}

export default async function globalSetup(config: FullConfig) {
  await rm(authDir, { recursive: true, force: true })
  await mkdir(authDir, { recursive: true })

  const baseURL = String(config.projects[0]?.use?.baseURL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173')
  const credentials = [
    [process.env.E2E_USER1_EMAIL, process.env.E2E_USER1_PASSWORD, user1State],
    [process.env.E2E_USER2_EMAIL, process.env.E2E_USER2_PASSWORD, user2State]
  ] as const

  for (const [email, password, statePath] of credentials) {
    if (email && password) await saveLoginState(baseURL, email, password, statePath)
  }
}
