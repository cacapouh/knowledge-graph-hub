import { test, expect } from '@playwright/test'

test('dashboard loads with sidebar navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  for (const label of ['Dashboard', 'Ontology', 'Graph', 'Views', 'Skills', 'Pull Requests']) {
    await expect(page.getByRole('link', { name: label })).toBeVisible()
  }
})

test('navigates to ontology page from sidebar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Ontology' }).click()
  await expect(page).toHaveURL(/\/ontology$/)
  await expect(page.getByRole('heading', { name: 'Ontology' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New Object Type' })).toBeVisible()
})
