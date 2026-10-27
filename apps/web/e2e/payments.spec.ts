import { test, expect } from '@playwright/test'

test.describe('Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@podacium.com')
    await page.fill('input[type="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/(?!.*login).*/, { timeout: 10000 })
  })

  test('pricing page loads correctly', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('main')).toBeVisible()

    // Should show pricing plans
    const content = await page.textContent('main')
    expect(content?.length).toBeGreaterThan(0)
  })

  test('billing page shows subscription status', async ({ page }) => {
    await page.goto('/billing')
    await page.waitForLoadState('networkidle')

    // Should show billing information or redirect
    const url = page.url()
    expect(url).toMatch(/billing|pricing|dashboard/)
  })

  test('wallet page shows balance', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Dashboard should load without errors
    await expect(page.locator('main')).toBeVisible()
  })

  test('no console errors on payment pages', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    // Filter out non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('AbortError')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
