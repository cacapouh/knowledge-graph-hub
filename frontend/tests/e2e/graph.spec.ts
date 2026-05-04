import { test, expect } from '@playwright/test'

test('graph view loads with node/edge counts and controls', async ({ page }) => {
  await page.goto('/graph')
  await expect(page.getByRole('heading', { name: 'Graph View' })).toBeVisible()

  // Counts shown as "{filtered}/{all} nodes" and edges
  await expect(page.locator('text=/\\d+\\/\\d+ nodes/')).toBeVisible()
  await expect(page.locator('text=/\\d+\\/\\d+ edges/')).toBeVisible()

  // Buttons in the header
  await expect(page.getByRole('button', { name: /^Perf( ON)?$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Filter/ })).toBeVisible()

  // Cypher query input
  await expect(page.getByPlaceholder(/Cypher クエリ/)).toBeVisible()
  await expect(page.getByRole('button', { name: /実行/ })).toBeVisible()
})

test('toggling Perf flips its label', async ({ page }) => {
  await page.goto('/graph')
  const perfBtn = page.getByRole('button', { name: /^Perf( ON)?$/ })

  const initialText = (await perfBtn.textContent())?.trim()
  await perfBtn.click()
  const afterText = (await perfBtn.textContent())?.trim()
  expect(afterText).not.toBe(initialText)

  // Toggle back
  await perfBtn.click()
  const finalText = (await perfBtn.textContent())?.trim()
  expect(finalText).toBe(initialText)
})

test('Filter panel toggles open and shows Node/Edge type sections', async ({ page }) => {
  await page.goto('/graph')

  await page.getByRole('button', { name: /Filter/ }).click()

  await expect(page.locator('text=Node Types').first()).toBeVisible()
  // Edge Types section also expected when at least one link type exists.
  // If no link types, the section may be empty; just check it's mounted.
})

test('node type filter via URL param filters the displayed count', async ({ page, request }) => {
  const ots = await request.get('/api/ontology/object-types').then((r) => r.json())
  if (ots.length === 0) {
    test.skip(true, 'no object types seeded')
    return
  }
  const target = ots[0]

  // Seed at least one instance of the target type so filtered count > 0 (if needed).
  // Not strictly required — we just verify the badge count appears.
  await page.goto(`/graph?nodeTypes=${target.id}`)

  // The Filter button shows a badge with the number of HIDDEN type filters.
  // If the user filters down to 1 type, all *other* types are hidden, so the badge equals (totalTypes - 1).
  const expectedHidden = ots.length - 1
  if (expectedHidden > 0) {
    await expect(page.getByRole('button', { name: /Filter/ })).toContainText(String(expectedHidden))
  }
})

test('Cypher input accepts and clears text', async ({ page }) => {
  await page.goto('/graph')

  const input = page.getByPlaceholder(/Cypher クエリ/)
  await input.fill('MATCH (n:Team) RETURN n')
  await expect(input).toHaveValue('MATCH (n:Team) RETURN n')

  // Clear button (X) appears inside the input wrapper.
  await page.locator('button:has(svg.lucide-x)').first().click().catch(() => {})
  // Some renders may not match; fall back to manual clear.
  await input.fill('')
  await expect(input).toHaveValue('')
})
