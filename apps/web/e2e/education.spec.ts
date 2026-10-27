import { test, expect } from '@playwright/test'

test.describe('Education Flow', () => {
  test('browse public course catalog', async ({ page }) => {
    await page.goto('/learn')
    
    // Should display course modules
    await expect(page.locator('main')).toBeVisible()
    
    // Should have course cards or module listings
    const content = await page.textContent('main')
    expect(content).toBeTruthy()
  })

  test('view course details', async ({ page }) => {
    await page.goto('/learn')
    
    // Click on first course/module link
    const courseLink = page.locator('a[href*="/learn/"]').first()
    if (await courseLink.isVisible()) {
      await courseLink.click()
      await page.waitForLoadState('networkidle')
      
      // Should show course details
      await expect(page.locator('h1, h2')).toBeVisible()
    }
  })

  test('enroll in course (authenticated)', async ({ page }) => {
    // Login first
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@podacium.com')
    await page.fill('input[type="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/(?!.*login).*/, { timeout: 10000 })

    // Navigate to a course
    await page.goto('/learn')
    const courseLink = page.locator('a[href*="/learn/"]').first()
    
    if (await courseLink.isVisible()) {
      await courseLink.click()
      await page.waitForLoadState('networkidle')

      // Look for enroll button
      const enrollBtn = page.locator('button:has-text("Enroll"), button:has-text("Start"), button:has-text("Begin")')
      if (await enrollBtn.isVisible()) {
        await enrollBtn.click()
        // Should show success or redirect to lesson
        await page.waitForTimeout(2000)
      }
    }
  })

  test('landing page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // No JS errors
    expect(errors).toHaveLength(0)

    // Key elements visible
    await expect(page.locator('nav, header')).toBeVisible()
    await expect(page.locator('main')).toBeVisible()
  })
})
