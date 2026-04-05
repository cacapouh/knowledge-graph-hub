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

// --- Projects ---
export interface Project {
  id: number
  name: string
  slug: string
  description: string
  owner_id: number
  created_at: string
  updated_at: string
}

// --- Datasets ---
export interface Dataset {
  id: number
  name: string
  description: string
  project_id: number
  schema_def: Record<string, unknown>
  storage_path: string
  row_count: number
  size_bytes: number
  format: string
  created_at: string
  updated_at: string
}

// --- Ontology ---
export interface ObjectType {
  id: number
  name: string
  api_name: string
  description: string
  project_id: number
  primary_key_property: string | null
  title_property: string | null
  icon: string
  color: string
  dataset_id: number | null
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
  project_id: number
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
  project_id: number
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

// --- Backups ---
export interface GraphBackup {
  id: number
  filename: string
  change_type: string
  description: string
  size_bytes: number
  created_at: string
}


