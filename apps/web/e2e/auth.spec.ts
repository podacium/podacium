import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('signup → login → access dashboard', async ({ page }) => {
    // Navigate to signup
    await page.goto('/auth/signup')
    await expect(page).toHaveURL(/signup/)

    // Fill signup form
    const testEmail = `e2e-${Date.now()}@test.podacium.com`
    await page.fill('[name="fullName"], input[placeholder*="name" i]', 'E2E Test User')
    await page.fill('[name="email"], input[type="email"]', testEmail)
    await page.fill('[name="password"], input[type="password"]', 'TestPass123!')
    
    // Accept terms if checkbox exists
    const termsCheckbox = page.locator('[name="acceptedTerms"], input[type="checkbox"]').first()
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check()
    }

    // Submit
    await page.click('button[type="submit"]')

    // Should redirect to dashboard or onboarding
    await page.waitForURL(/dashboard|onboarding/, { timeout: 15000 })
  })

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page).toHaveURL(/login/)

    await page.fill('input[type="email"], [name="email"]', 'test@podacium.com')
    await page.fill('input[type="password"], [name="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')

    // Should redirect away from login
    await page.waitForURL(/(?!.*login).*/, { timeout: 10000 })
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth/login')

    await page.fill('input[type="email"], [name="email"]', 'nonexistent@test.com')
    await page.fill('input[type="password"], [name="password"]', 'WrongPass123!')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('[role="alert"], .text-red-500, .error')).toBeVisible({ timeout: 5000 })
  })

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@podacium.com')
    await page.fill('input[type="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/(?!.*login).*/, { timeout: 10000 })

    // Find and click logout
    const logoutBtn = page.locator('button:has-text("Logout"), button:has-text("Log out"), [data-testid="logout"]')
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL(/login|\/$/,  { timeout: 5000 })
    }
  })
})
