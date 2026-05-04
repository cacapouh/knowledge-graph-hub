import { test, expect } from '@playwright/test'

const NAV_LABELS = ['Dashboard', 'Ontology', 'Graph', 'Views', 'Skills', 'Pull Requests']

test('dashboard renders with sidebar navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  for (const label of NAV_LABELS) {
    await expect(page.getByRole('link', { name: label })).toBeVisible()
  }
})

test('stats cards reflect ontology counts', async ({ page, request }) => {
  const ots = await request.get('/api/ontology/object-types').then((r) => r.json())
  const lts = await request.get('/api/ontology/link-types').then((r) => r.json())

  await page.goto('/')

  // The Object Types stat card is a Link to /ontology, so locate by label inside.
  const objectTypesCard = page.getByRole('link', { name: /Object Types/ }).first()
  const linkTypesCard = page.getByRole('link', { name: /Link Types/ }).first()

  await expect(objectTypesCard).toContainText(String(ots.length))
  await expect(linkTypesCard).toContainText(String(lts.length))
})

test('clicking Ontology stat card navigates to /ontology', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Object Types/ }).first().click()
  await expect(page).toHaveURL(/\/ontology$/)
})

test('clicking an object type in the list navigates to its explorer', async ({ page, request }) => {
  const ots = await request.get('/api/ontology/object-types').then((r) => r.json())
  if (ots.length === 0) {
    test.skip(true, 'no object types seeded')
    return
  }
  const target = ots[0]

  await page.goto('/')
  // Each list item is a Link with the type name + api_name visible.
  await page.getByRole('link', { name: new RegExp(`${target.name}.*${target.api_name}`) }).first().click()
  await expect(page).toHaveURL(new RegExp(`/ontology/explorer/${target.id}$`))
})

test('sidebar navigates between top-level pages', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Skills' }).click()
  await expect(page).toHaveURL(/\/skills$/)
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()

  await page.getByRole('link', { name: 'Views' }).click()
  await expect(page).toHaveURL(/\/views$/)
  await expect(page.getByRole('heading', { name: 'Saved Views' })).toBeVisible()

  await page.getByRole('link', { name: 'Pull Requests' }).click()
  await expect(page).toHaveURL(/\/gpr$/)
  await expect(page.getByRole('heading', { name: 'Graph Pull Requests' })).toBeVisible()

  await page.getByRole('link', { name: 'Graph' }).click()
  await expect(page).toHaveURL(/\/graph$/)
  await expect(page.getByRole('heading', { name: 'Graph View' })).toBeVisible()
})
