import { test, expect } from '@playwright/test'

test('create and delete an Object Type', async ({ page, request }) => {
  const suffix = Date.now().toString(36)
  const name = `e2e_ot_${suffix}`

  await page.goto('/ontology')
  await expect(page.getByRole('heading', { name: 'Ontology' })).toBeVisible()

  await page.getByRole('button', { name: 'New Object Type' }).click()

  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create', exact: true }) })
  await form.locator('input').first().fill(name)
  await form.getByRole('button', { name: 'Create', exact: true }).click()

  const card = page.locator('div', { hasText: name }).first()
  await expect(card).toBeVisible()

  // Cleanup via API so we don't depend on hover-to-reveal delete UI
  const list = await request.get('/api/ontology/object-types').then((r) => r.json())
  const created = list.find((o: { name: string }) => o.name === name)
  if (created) {
    await request.delete(`/api/ontology/object-types/${created.id}`)
  }
})
