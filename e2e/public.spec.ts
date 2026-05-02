import { expect, test } from '@playwright/test'

const protectedRoutePattern = /\/auth\/login/

test.describe('public quality gates', () => {
  test('home communicates the split workbench concept', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Chat and Document/i })).toBeVisible()
    await expect(page.getByRole('link', { name: '로그인하고 시작' })).toBeVisible()
    await expect(page.getByText('Zustand')).toBeVisible()
    await expect(page.getByText('TanStack Query')).toBeVisible()
    await expect(page.getByText('Yjs')).toBeVisible()
  })

  test('api contract route renders the backend contract page', async ({ page }) => {
    await page.goto('/api-contract')
    await expect(page).toHaveURL(/\/api-contract$/)
    await expect(page.getByRole('heading', { name: '프론트와 백엔드가 공유하는 계약' })).toBeVisible()
    await expect(page.getByText('Supabase tables')).toBeVisible()
    await expect(page.getByText('Realtime endpoints')).toBeVisible()
  })

  test('unauthenticated protected routes redirect to login', async ({ page }) => {
    await page.goto('/workspaces')
    await expect(page).toHaveURL(protectedRoutePattern)
    await expect(page.getByRole('heading', { name: '다시 입장하기' })).toBeVisible()
  })

  test('robots.txt is valid and crawl-friendly', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.ok()).toBe(true)
    const body = await response.text()
    expect(body).toContain('User-agent: *')
    expect(body).toContain('Allow: /')
    expect(body).not.toContain('<!doctype html>')
  })

  test('login mode switch has a mobile-safe tap target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/auth/login')
    const toggle = page.getByRole('button', { name: /가입하기|로그인/ }).last()
    await expect(toggle).toBeVisible()
    const box = await toggle.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(36)
  })
})
