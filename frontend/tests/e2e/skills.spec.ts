import { test, expect } from '@playwright/test'

test('create and delete a Skill', async ({ page, request }) => {
  const suffix = Date.now().toString(36)
  const name = `e2e_skill_${suffix}`

  await page.goto('/skills')
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()

  await page.getByRole('button', { name: 'New Skill' }).click()

  await page.getByRole('textbox').first().fill(name)
  await page.locator('textarea').first().fill('e2e test prompt body')

  await page.getByRole('button', { name: 'Create' }).click()

  const card = page.getByRole('heading', { name, level: 2 })
  await expect(card).toBeVisible()

  // Cleanup via API to avoid the confirm() dialog dance
  const list = await request.get('/api/skills').then((r) => r.json())
  const created = list.find((s: { name: string }) => s.name === name)
  if (created) {
    await request.delete(`/api/skills/${created.id}`)
  }
})
