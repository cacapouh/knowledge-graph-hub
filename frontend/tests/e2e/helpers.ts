import type { APIRequestContext, Locator, Page } from '@playwright/test'

/** Unique suffix so concurrent / repeated runs don't collide. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Auto-accept any window.confirm()/alert() dialogs that appear on the page. */
export function autoAcceptDialogs(page: Page) {
  page.on('dialog', (d) => {
    d.accept().catch(() => {})
  })
}

/**
 * Locate a card-shaped container (rounded-xl) that contains the given heading.
 * Avoids the trap where `page.locator('div').filter({has: heading})` matches
 * every ancestor div, not just the card.
 */
export function cardWithHeading(page: Page, name: string, level: 2 | 3 = 2): Locator {
  return page
    .locator('div.rounded-xl')
    .filter({ has: page.getByRole('heading', { name, level }) })
    .first()
}

/**
 * HTML <button> element with exact text. ReactFlow node divs have role="button"
 * and pollute getByRole('button', ...) results — using a CSS selector for actual
 * <button> tags sidesteps that.
 */
export function htmlButton(page: Page | Locator, text: string): Locator {
  return page.locator('button').filter({ hasText: new RegExp(`^\\s*${escapeRegex(text)}\\s*$`) })
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ─── API helpers (talk to backend through the dev-server proxy) ─── */

export type ObjectType = {
  id: number
  name: string
  api_name: string
  color: string
  description: string
  title_property: string | null
}

export type PropertyType = {
  id: number
  object_type_id: number
  name: string
  api_name: string
  data_type: string
  is_required: boolean
  default_value: unknown
}

export type ObjectInstance = {
  id: number
  object_type_id: number
  properties: Record<string, unknown>
}

export type LinkType = {
  id: number
  name: string
  source_object_type_id: number
  target_object_type_id: number
  cardinality: string
}

export type Skill = {
  id: number
  name: string
  description: string
  prompt: string
  mcps: Array<Record<string, unknown>>
}

export type SavedView = {
  id: number
  name: string
  description: string
  object_type_ids: number[]
  link_type_ids: number[]
}

export type GraphPullRequest = {
  id: number
  title: string
  description: string
  source: string
  status: 'open' | 'merged' | 'failed' | 'reverted' | 'closed'
  auto_merge: boolean
  operations: Array<Record<string, unknown>>
  apply_log: Array<Record<string, unknown>>
}

export async function createObjectType(
  request: APIRequestContext,
  data: Partial<ObjectType> & { name: string },
): Promise<ObjectType> {
  const res = await request.post('/api/ontology/object-types', {
    data: {
      name: data.name,
      api_name: data.api_name ?? data.name.replace(/\s+/g, '_').toLowerCase(),
      description: data.description ?? '',
      icon: 'cube',
      color: data.color ?? '#6366f1',
    },
  })
  if (!res.ok()) throw new Error(`createObjectType failed: ${res.status()} ${await res.text()}`)
  return (await res.json()) as ObjectType
}

export async function deleteObjectType(request: APIRequestContext, id: number): Promise<void> {
  await request.delete(`/api/ontology/object-types/${id}`)
}

export async function listObjectTypes(request: APIRequestContext): Promise<ObjectType[]> {
  const res = await request.get('/api/ontology/object-types')
  return (await res.json()) as ObjectType[]
}

export async function listSkills(request: APIRequestContext): Promise<Skill[]> {
  const res = await request.get('/api/skills')
  return (await res.json()) as Skill[]
}

export async function deleteSkill(request: APIRequestContext, id: number): Promise<void> {
  await request.delete(`/api/skills/${id}`)
}

export async function listSavedViews(request: APIRequestContext): Promise<SavedView[]> {
  const res = await request.get('/api/views')
  return (await res.json()) as SavedView[]
}

export async function deleteSavedView(request: APIRequestContext, id: number): Promise<void> {
  await request.delete(`/api/views/${id}`)
}

export async function createGpr(
  request: APIRequestContext,
  data: { title: string; description?: string; auto_merge?: boolean; operations: Array<Record<string, unknown>> },
): Promise<GraphPullRequest> {
  const res = await request.post('/api/gpr', {
    data: {
      title: data.title,
      description: data.description ?? '',
      auto_merge: data.auto_merge ?? false,
      operations: data.operations,
    },
  })
  if (!res.ok()) throw new Error(`createGpr failed: ${res.status()} ${await res.text()}`)
  return (await res.json()) as GraphPullRequest
}

export async function listGprs(request: APIRequestContext): Promise<GraphPullRequest[]> {
  const res = await request.get('/api/gpr?limit=200')
  return (await res.json()) as GraphPullRequest[]
}
