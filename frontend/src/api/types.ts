// --- Auth ---
export interface User {
  id: number
  email: string
  name: string
  is_admin: boolean
  is_active: boolean
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
  user: User
}

// --- Ontology ---
export interface ObjectType {
  id: number
  name: string
  api_name: string
  description: string
  primary_key_property: string | null
  title_property: string | null
  icon: string
  color: string
  created_at: string
  updated_at: string
}

export interface PropertyType {
  id: number
  object_type_id: number
  name: string
  api_name: string
  description: string
  data_type: string
  is_required: boolean
  is_indexed: boolean
  is_array: boolean
  config: Record<string, unknown>
  created_at: string
}

export interface LinkType {
  id: number
  name: string
  api_name: string
  description: string
  source_object_type_id: number
  target_object_type_id: number
  cardinality: string
  inverse_name: string | null
  created_at: string
}

export interface ActionTypeData {
  id: number
  name: string
  api_name: string
  description: string
  object_type_id: number | null
  parameters: unknown[]
  logic: Record<string, unknown>
  created_at: string
}

export interface ObjectInstance {
  id: number
  object_type_id: number
  properties: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface LinkInstance {
  id: number
  link_type_id: number
  source_object_id: number
  target_object_id: number
  properties: Record<string, unknown>
  created_at: string
}

// --- Cypher Query ---
export interface CypherResult {
  objects: ObjectInstance[]
  links: LinkInstance[]
}

// --- Graph Pull Request ---
export type GprStatus = 'open' | 'merged' | 'failed' | 'reverted' | 'closed'

export type GprOperation =
  | { op: 'create_object'; client_id?: string; object_type: string | number; properties: Record<string, unknown> }
  | { op: 'update_object'; object_id: number; properties: Record<string, unknown> }
  | { op: 'delete_object'; object_id: number }
  | {
      op: 'create_link'
      link_type: string | number
      source: { object_id?: number; client_id?: string }
      target: { object_id?: number; client_id?: string }
      properties?: Record<string, unknown>
    }
  | { op: 'delete_link'; link_id: number }

export interface GprApplyLogEntry {
  index: number
  op: GprOperation
  ok: boolean
  error?: string
  created_object_id?: number
  updated_object_id?: number
  deleted_object_id?: number
  created_link_id?: number
  deleted_link_id?: number
  [key: string]: unknown
}

export interface GraphPullRequest {
  id: number
  title: string
  description: string
  source: string
  status: GprStatus
  auto_merge: boolean
  operations: GprOperation[]
  apply_log: GprApplyLogEntry[]
  inverse_ops: GprOperation[]
  applied_at: string | null
  created_at: string
  updated_at: string
}

// --- Saved Views ---
export interface SavedView {
  id: number
  name: string
  description: string
  object_type_ids: number[]
  link_type_ids: number[]
  created_at: string
  updated_at: string
}
