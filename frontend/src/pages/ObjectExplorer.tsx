import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ObjectType, PropertyType, ObjectInstance, LinkInstance, Skill } from '../api/types'
import { Plus, Trash2, ChevronRight, Wand2 } from 'lucide-react'

interface DiscoveredProperty {
  api_name: string
  inferred_data_type: string
  is_array: boolean
  sample: unknown
  count: number
}

const URL_RE = /https?:\/\/[^\s]+/g

function textWithLinks(text: string) {
  const parts: (string | { url: string })[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    parts.push({ url: m[0] })
    lastIndex = URL_RE.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  if (parts.length === 1 && typeof parts[0] === 'string') return <>{text}</>
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-800">{p.url}</a>
        ),
      )}
    </>
  )
}

function renderPropValue(s: string) {
  // Handle stringified JSON arrays like '["item1", "item2"]'
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        const items = parsed.map(String)
        if (items.length === 0) return <span className="text-gray-400">—</span>
        return (
          <div className="space-y-1">
            {items.map((item, i) => <div key={i}>{textWithLinks(item)}</div>)}
          </div>
        )
      }
    } catch { /* not JSON */ }
  }
  return textWithLinks(s)
}

export default function ObjectExplorer() {
  const { objectTypeId } = useParams<{ objectTypeId: string }>()
  const typeId = Number(objectTypeId)
  const queryClient = useQueryClient()

  const [selectedObject, setSelectedObject] = useState<ObjectInstance | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProps, setNewProps] = useState<Record<string, string>>({})

  const { data: objectType } = useQuery({
    queryKey: ['objectType', typeId],
    queryFn: () => api.get<ObjectType>(`/ontology/object-types/${typeId}`),
  })

  const { data: properties } = useQuery({
    queryKey: ['properties', typeId],
    queryFn: () => api.get<PropertyType[]>(`/ontology/object-types/${typeId}/properties`),
  })

  const { data: discovered } = useQuery({
    queryKey: ['discovered-properties', typeId],
    queryFn: () => api.get<DiscoveredProperty[]>(`/ontology/object-types/${typeId}/discovered-properties`),
  })

  const invalidateSchema = () => {
    queryClient.invalidateQueries({ queryKey: ['properties', typeId] })
    queryClient.invalidateQueries({ queryKey: ['discovered-properties', typeId] })
  }

  const defineProperty = useMutation({
    mutationFn: (d: DiscoveredProperty) => api.post('/ontology/properties', {
      object_type_id: typeId,
      name: d.api_name,
      api_name: d.api_name,
      data_type: d.inferred_data_type,
      is_array: d.is_array,
      is_required: false,
    }),
    onSuccess: invalidateSchema,
  })

  const syncAllSchema = useMutation({
    mutationFn: () => api.post(`/ontology/object-types/${typeId}/sync-schema`, {}),
    onSuccess: invalidateSchema,
  })

  const { data: objects } = useQuery({
    queryKey: ['objects', typeId],
    queryFn: () => api.get<ObjectInstance[]>(`/ontology/objects?object_type_id=${typeId}`),
  })

  const { data: links } = useQuery({
    queryKey: ['links', selectedObject?.id],
    queryFn: () => api.get<LinkInstance[]>(`/ontology/objects/${selectedObject!.id}/links`),
    enabled: !!selectedObject,
  })

  const createObject = useMutation({
    mutationFn: (data: { object_type_id: number; properties: Record<string, unknown> }) =>
      api.post('/ontology/objects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', typeId] })
      setShowCreateForm(false)
      setNewProps({})
    },
  })

  const deleteObject = useMutation({
    mutationFn: (id: number) => api.delete(`/ontology/objects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', typeId] })
      setSelectedObject(null)
    },
  })

  // Add property form (data_type: 'string' | 'skill')
  const [showAddProp, setShowAddProp] = useState(false)
  const [propForm, setPropForm] = useState({
    name: '',
    api_name: '',
    data_type: 'string' as 'string' | 'skill',
    is_required: false,
    default_value: '',
  })

  const createProperty = useMutation({
    mutationFn: (data: any) => api.post('/ontology/properties', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', typeId] })
      setShowAddProp(false)
      setPropForm({ name: '', api_name: '', data_type: 'string', is_required: false, default_value: '' })
    },
  })

  // Skills (used when a property has data_type='skill')
  const { data: skills = [] } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.get<Skill[]>('/skills'),
  })
  const skillById = new Map(skills.map((s) => [s.id, s]))

  const titleProp = objectType?.title_property

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/ontology" className="text-sm text-brand-600 hover:underline">← Ontology</Link>
        <div className="flex items-center gap-3 mt-2">
          {objectType && (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: objectType.color }}>
              {objectType.name[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{objectType?.name ?? 'Loading...'}</h1>
            <p className="text-sm text-gray-500">{objectType?.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Properties panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Properties</h2>
            <button onClick={() => setShowAddProp(true)} className="text-brand-600 hover:text-brand-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showAddProp && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (propForm.data_type === 'skill') {
                  const skillId = parseInt(propForm.default_value, 10)
                  const skill = skillById.get(skillId)
                  if (!skill) return // select is required, but guard anyway
                  const apiName = skill.name.replace(/\s+/g, '_').toLowerCase()
                  createProperty.mutate({
                    name: skill.name,
                    api_name: apiName,
                    data_type: 'skill',
                    is_required: propForm.is_required,
                    default_value: skill.id,
                    object_type_id: typeId,
                  })
                } else {
                  createProperty.mutate({
                    name: propForm.name,
                    api_name: propForm.api_name,
                    data_type: 'string',
                    is_required: propForm.is_required,
                    default_value: propForm.default_value === '' ? null : propForm.default_value,
                    object_type_id: typeId,
                  })
                }
              }}
              className="mb-4 space-y-2 p-3 bg-gray-50 rounded-lg"
            >
              <select
                value={propForm.data_type}
                onChange={(e) => setPropForm({ ...propForm, data_type: e.target.value as 'string' | 'skill', default_value: '', name: '', api_name: '' })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="string">string</option>
                <option value="skill">skill</option>
              </select>

              {propForm.data_type === 'skill' ? (
                <select
                  value={propForm.default_value}
                  onChange={(e) => setPropForm({ ...propForm, default_value: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  required
                >
                  <option value="">— select skill —</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    placeholder="Property name"
                    value={propForm.name}
                    onChange={(e) => setPropForm({ ...propForm, name: e.target.value, api_name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    required
                  />
                  <input
                    placeholder="Default value (optional)"
                    value={propForm.default_value}
                    onChange={(e) => setPropForm({ ...propForm, default_value: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  />
                </>
              )}

              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={propForm.is_required}
                  onChange={(e) => setPropForm({ ...propForm, is_required: e.target.checked })}
                />
                Required
              </label>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1 bg-brand-600 text-white rounded text-xs">Add</button>
                <button type="button" onClick={() => setShowAddProp(false)} className="px-3 py-1 text-gray-500 text-xs">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {properties?.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm">
                <div>
                  <span className="font-medium">{p.name}</span>
                  {p.data_type === 'skill' && (
                    <span className="ml-2 text-xs text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 font-mono">skill</span>
                  )}
                  {p.default_value !== null && p.default_value !== undefined && (
                    <span className="ml-2 text-xs text-gray-400">
                      = {p.data_type === 'skill'
                        ? (skillById.get(Number(p.default_value))?.name ?? String(p.default_value))
                        : String(p.default_value)}
                    </span>
                  )}
                </div>
                {p.is_required && <span className="text-xs text-red-400">required</span>}
              </div>
            ))}
            {properties?.length === 0 && (
              <p className="text-sm text-gray-400">No properties defined.</p>
            )}
          </div>

          {discovered && discovered.length > 0 && (
            <div className="mt-5 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-amber-700">Discovered ({discovered.length})</h3>
                  <p className="text-xs text-gray-500">Keys present in instances but undefined in the schema.</p>
                </div>
                <button
                  onClick={() => syncAllSchema.mutate()}
                  disabled={syncAllSchema.isPending}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
                  title="Define all discovered properties"
                >
                  <Wand2 className="w-3 h-3" />
                  Sync all
                </button>
              </div>
              <div className="space-y-2">
                {discovered.map((d) => (
                  <div key={d.api_name} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 text-sm">
                    <div className="min-w-0 flex-1">
                      <div>
                        <span className="font-medium">{d.api_name}</span>
                        <span className="ml-2 text-xs text-gray-400">×{d.count}</span>
                      </div>
                      {d.sample !== null && d.sample !== undefined && (
                        <div className="text-xs text-gray-500 truncate">e.g. {String(d.sample)}</div>
                      )}
                    </div>
                    <button
                      onClick={() => defineProperty.mutate(d)}
                      disabled={defineProperty.isPending}
                      className="ml-2 px-2 py-1 text-xs font-medium text-amber-700 bg-white border border-amber-200 rounded hover:bg-amber-100 disabled:opacity-50"
                    >
                      Define
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Objects list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Objects ({objects?.length ?? 0})</h2>
            <button onClick={() => setShowCreateForm(true)} className="text-brand-600 hover:text-brand-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showCreateForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const props: Record<string, unknown> = {}
                for (const [key, val] of Object.entries(newProps)) {
                  if (val) props[key] = val
                }
                createObject.mutate({ object_type_id: typeId, properties: props })
              }}
              className="mb-4 space-y-2 p-3 bg-gray-50 rounded-lg"
            >
              {properties?.map((p) => (
                <div key={p.id}>
                  <label className="text-xs font-medium text-gray-600">{p.name}</label>
                  {p.data_type === 'skill' ? (
                    <select
                      value={newProps[p.api_name] ?? ''}
                      onChange={(e) => setNewProps({ ...newProps, [p.api_name]: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      required={p.is_required}
                    >
                      <option value="">— select skill —</option>
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={newProps[p.api_name] ?? ''}
                      onChange={(e) => setNewProps({ ...newProps, [p.api_name]: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      required={p.is_required}
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-3 py-1 bg-brand-600 text-white rounded text-xs">Create</button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="px-3 py-1 text-gray-500 text-xs">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {objects?.map((obj) => {
              const title = titleProp ? String(obj.properties[titleProp] ?? `Object #${obj.id}`) : `Object #${obj.id}`
              return (
                <button
                  key={obj.id}
                  onClick={() => setSelectedObject(obj)}
                  className={`w-full text-left flex items-center justify-between p-3 rounded-lg text-sm transition-colors ${
                    selectedObject?.id === obj.id ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-medium truncate">{title}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              )
            })}
            {objects?.length === 0 && (
              <p className="text-sm text-gray-400">No objects yet.</p>
            )}
          </div>
        </div>

        {/* Object detail */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold mb-4">Object Detail</h2>
          {selectedObject ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">ID: {selectedObject.id}</span>
                <button
                  onClick={() => deleteObject.mutate(selectedObject.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                {(() => {
                  const props = selectedObject.properties
                  const seen = new Set<string>()
                  const rows: { key: string; value: unknown; fromDefault: boolean; propType: PropertyType | undefined }[] = []
                  for (const p of properties ?? []) {
                    const has = p.api_name in props && props[p.api_name] !== null && props[p.api_name] !== ''
                    rows.push({
                      key: p.api_name,
                      value: has ? props[p.api_name] : p.default_value,
                      fromDefault: !has && p.default_value !== null && p.default_value !== undefined,
                      propType: p,
                    })
                    seen.add(p.api_name)
                  }
                  for (const [k, v] of Object.entries(props)) {
                    if (seen.has(k)) continue
                    rows.push({ key: k, value: v, fromDefault: false, propType: undefined })
                  }
                  return rows
                })().map(({ key, value, fromDefault, propType }) => {
                  const isSkill = propType?.data_type === 'skill'
                  const skill = isSkill ? skillById.get(Number(value)) : undefined
                  const isEmpty = value === null || value === undefined || value === ''
                  return (
                    <div key={key} className="text-sm">
                      <div className="text-gray-500 font-medium text-xs uppercase flex items-center gap-1">
                        {key}
                        {fromDefault && (
                          <span className="text-[10px] tracking-wide text-gray-400">(default)</span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        {isEmpty ? (
                          <span className="text-gray-400">—</span>
                        ) : isSkill ? (
                          skill ? (
                            <span className="inline-block px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded font-medium">
                              {skill.name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">skill #{String(value)} (missing)</span>
                          )
                        ) : (
                          renderPropValue(String(value))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Links */}
              <h3 className="text-sm font-semibold mb-2 text-gray-600">Links</h3>
              {links && links.length > 0 ? (
                <div className="space-y-2">
                  {links.map((l) => (
                    <div key={l.id} className="p-2 bg-gray-50 rounded text-xs">
                      {l.source_object_id === selectedObject.id
                        ? `→ Object #${l.target_object_id}`
                        : `← Object #${l.source_object_id}`}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No links</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Select an object to view details.</p>
          )}
        </div>
      </div>
    </div>
  )
}
