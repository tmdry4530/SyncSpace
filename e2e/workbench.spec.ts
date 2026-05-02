import { expect, test, type BrowserContext } from '@playwright/test'
import { existsSync } from 'node:fs'
import path from 'node:path'

const user1State = path.join(process.cwd(), 'test-results', '.auth', 'user1.json')
const user2State = path.join(process.cwd(), 'test-results', '.auth', 'user2.json')
const workbenchUrl = process.env.E2E_WORKBENCH_URL

function hasState(statePath: string) {
  return existsSync(statePath)
}

async function closeAll(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close()))
}

test.describe('authenticated workbench', () => {
  test('mobile drawer exposes only safe visible tap targets', async ({ browser }) => {
    test.skip(!workbenchUrl || !hasState(user1State), 'Set E2E_USER1_* and E2E_WORKBENCH_URL for auth storageState setup')
    const context = await browser.newContext({ storageState: user1State, viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    try {
      await page.goto(workbenchUrl!)
      await expect(page.getByRole('button', { name: '메뉴', exact: true })).toBeVisible()
      await page.getByRole('button', { name: '메뉴', exact: true }).click()
      await expect(page.getByRole('button', { name: '사이드바 닫기' })).toHaveCount(1)
      const undersized = await page.locator('a,button,input,textarea,[role=button]').evaluateAll((elements) =>
        elements
          .filter((element) => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && (rect.width < 44 || rect.height < 44)
          })
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              text: (element.textContent ?? element.getAttribute('aria-label') ?? '').trim(),
              width: rect.width,
              height: rect.height
            }
          })
      )
      expect(undersized).toEqual([])
    } finally {
      await context.close()
    }
  })

  test('two users receive chat and document updates without refresh', async ({ browser }) => {
    test.skip(
      !workbenchUrl || !hasState(user1State) || !hasState(user2State),
      'Set E2E_USER1_*, E2E_USER2_*, and E2E_WORKBENCH_URL for auth storageState setup'
    )
    const first = await browser.newContext({ storageState: user1State })
    const second = await browser.newContext({ storageState: user2State })
    const contexts = [first, second]
    try {
      const page1 = await first.newPage()
      const page2 = await second.newPage()
      await page1.goto(workbenchUrl!)
      await page2.goto(workbenchUrl!)
      const stamp = Date.now()
      const chatText = `e2e realtime chat ${stamp}`
      await page1.getByPlaceholder('메시지를 입력하고 Enter').fill(chatText)
      await page1.getByRole('button', { name: '보내기' }).click()
      await expect(page2.getByText(chatText)).toBeVisible()

      const docText = `e2e realtime doc ${stamp}`
      await page1.locator('.ProseMirror').click()
      await page1.keyboard.type(docText)
      await expect(page2.getByText(docText)).toBeVisible()
    } finally {
      await closeAll(contexts)
    }
  })
})
