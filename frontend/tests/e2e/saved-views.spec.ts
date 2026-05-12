import { test, expect } from '@playwright/test'
import {
  uniqueSuffix,
  listSavedViews,
  deleteSavedView,
  autoAcceptDialogs,
  cardWithHeading,
} from './helpers'

test('renders empty state or existing list', async ({ page }) => {
  await page.goto('/views')
  await expect(page.getByRole('heading', { name: 'Saved Views' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新規ビュー' })).toBeVisible()
})

test('creates a saved view with selected node types and verifies graph link', async ({ page, request }) => {
  const ots = await request.get('/api/ontology/object-types').then((r) => r.json())
  if (ots.length === 0) {
    test.skip(true, 'no object types seeded')
    return
  }
  const target = ots[0]

  const name = `e2e_view_${uniqueSuffix()}`
  let createdId: number | null = null

  try {
    await page.goto('/views')
    await page.getByRole('button', { name: '新規ビュー' }).click()

    const createBlock = page.locator('div.bg-gray-50').filter({
      has: page.getByText('新しいビューを作成'),
    })

    await createBlock.getByPlaceholder(/ビュー名/).fill(name)
    // Add a type_filter condition card, then pick the target node type inside it.
    await createBlock.getByRole('button', { name: /種別で絞り込み/ }).click()
    await createBlock.getByRole('button', { name: target.name }).first().click()
    await createBlock.getByRole('button', { name: '作成' }).click()

    const card = cardWithHeading(page, name, 3)
    await expect(card).toBeVisible()

    const graphLink = card.getByRole('link', { name: /Graph で開く/ })
    // The graph URL now opens the view by id so all conditions (incl.
    // neighborhoods) can be applied uniformly.
    await expect(graphLink).toHaveAttribute('href', /viewId=\d+/)

    const views = await listSavedViews(request)
    const created = views.find((v) => v.name === name)
    expect(created).toBeTruthy()
    expect(created!.object_type_ids).toContain(target.id)
    createdId = created!.id
  } finally {
    if (createdId !== null) await deleteSavedView(request, createdId)
  }
})

test('edits a saved view inline', async ({ page, request }) => {
  const ots = await request.get('/api/ontology/object-types').then((r) => r.json())
  if (ots.length === 0) {
    test.skip(true, 'no object types seeded')
    return
  }

  const original = `e2e_view_edit_${uniqueSuffix()}`
  const updated = `${original}_renamed`

  const seeded = await request.post('/api/views', {
    data: {
      name: original,
      description: '',
      object_type_ids: [ots[0].id],
      link_type_ids: [],
    },
  }).then((r) => r.json())

  try {
    await page.goto('/views')
    const card = cardWithHeading(page, original, 3)
    await card.getByRole('button', { name: '編集' }).click()

    // The card morphed into edit mode in place; the same card now contains 保存/キャンセル.
    // Find inputs within the card-shaped container that has a 保存 button.
    const editingCard = page.locator('div.rounded-xl').filter({
      has: page.getByRole('button', { name: '保存' }),
    }).first()
    await editingCard.locator('input').first().fill(updated)
    await editingCard.getByRole('button', { name: '保存' }).click()

    await expect(page.getByRole('heading', { name: updated, level: 3 })).toBeVisible()
  } finally {
    await deleteSavedView(request, seeded.id)
  }
})

test('deletes a saved view via the UI (confirm dialog)', async ({ page, request }) => {
  autoAcceptDialogs(page)

  const ots = await request.get('/api/ontology/object-types').then((r) => r.json())
  if (ots.length === 0) {
    test.skip(true, 'no object types seeded')
    return
  }

  const name = `e2e_view_del_${uniqueSuffix()}`
  const seeded = await request.post('/api/views', {
    data: {
      name,
      description: '',
      object_type_ids: [ots[0].id],
      link_type_ids: [],
    },
  }).then((r) => r.json())

  try {
    await page.goto('/views')
    const card = cardWithHeading(page, name, 3)
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: '削除' }).click()

    await expect(page.getByRole('heading', { name, level: 3 })).toHaveCount(0)
  } catch (e) {
    await deleteSavedView(request, seeded.id).catch(() => {})
    throw e
  }
})
