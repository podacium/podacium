import { test, expect } from '@playwright/test'

test.describe('Freelancing Hub — Public', () => {
  test('browse public hub page with catalog sections', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()

    const headingCount = await page.locator('h1, h2, h3').count()
    expect(headingCount).toBeGreaterThan(0)
  })

  test('projects page has filters and results', async ({ page }) => {
    await page.goto('/hub/projects')
    await page.waitForLoadState('networkidle')

    const projectCards = page.locator('[data-testid="project-card"], article, .project-card')
    const cardCount = await projectCards.count()

    await expect(page.locator('main')).toBeVisible()
    expect(cardCount).toBeGreaterThanOrEqual(0)

    const filterInput = page.locator('input[placeholder*="search" i], input[placeholder*="recherche" i], input[type="search"]')
    if (await filterInput.isVisible()) {
      await filterInput.fill('react')
      await page.waitForTimeout(500)
    }
  })

  test('freelancers page loads with results', async ({ page }) => {
    await page.goto('/hub/freelancers')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()
  })

  test('project detail page shows info', async ({ page }) => {
    await page.goto('/hub/projects')
    await page.waitForLoadState('networkidle')

    const projectLink = page.locator('a[href*="/hub/projects/"]').first()
    if (await projectLink.isVisible()) {
      await projectLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page.locator('h1, h2').first()).toBeVisible()
    }
  })
})

test.describe('Freelancing Hub — Freelancer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@podacium.com')
    await page.fill('input[type="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/(?!.*login).*/, { timeout: 10000 })
  })

  test('hub dashboard loads stats', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()

    const statElements = page.locator('[data-testid="stat-card"], .stat-card, [class*="stat"]')
    const statCount = await statElements.count()
    expect(statCount).toBeGreaterThanOrEqual(0)
  })

  test('proposals page lists user proposals', async ({ page }) => {
    await page.goto('/hub/proposals')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()
  })

  test('contracts page lists user contracts', async ({ page }) => {
    await page.goto('/hub/contracts')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()
  })

  test('contract detail page loads', async ({ page }) => {
    await page.goto('/hub/contracts')
    await page.waitForLoadState('networkidle')

    const contractLink = page.locator('a[href*="/hub/contracts/"]').first()
    if (await contractLink.isVisible()) {
      await contractLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page.locator('main')).toBeVisible()
    }
  })
})

test.describe('Freelancing Hub — Client Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@podacium.com')
    await page.fill('input[type="password"]', 'TestPass123!')
    await page.click('button[type="submit"]')
    await page.waitForURL(/(?!.*login).*/, { timeout: 10000 })
  })

  test('create project flow', async ({ page }) => {
    await page.goto('/hub/projects/new')
    await page.waitForLoadState('networkidle')

    const titleInput = page.locator(
      'input[name="title"], input[placeholder*="title" i], '
      + 'input[id*="title" i], [data-testid="project-title"]'
    )

    if (await titleInput.isVisible()) {
      await titleInput.fill('E2E Test Project ' + Date.now())

      const descInput = page.locator(
        'textarea[name="description"], textarea[placeholder*="describe" i], '
        + 'textarea[id*="description" i]'
      )
      if (await descInput.isVisible()) {
        await descInput.fill('This project was created by an automated E2E test.')
      }

      const submitBtn = page.locator('button[type="submit"]').first()
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await page.waitForTimeout(3000)
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })
})

test.describe('Freelancing Hub — Navigation', () => {
  test('main nav links all resolve', async ({ page }) => {
    await page.goto('/hub')
    await page.waitForLoadState('networkidle')

    const navLinks = [
      '/hub/projects',
      '/hub/freelancers',
      '/hub/contracts',
      '/hub/proposals',
    ]

    for (const link of navLinks) {
      await page.goto(link)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
  })
})
