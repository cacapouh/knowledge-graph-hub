import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ObjectType, PropertyType, ObjectInstance, LinkInstance } from '../api/types'
import { Plus, Trash2, ChevronRight } from 'lucide-react'

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

  // Add property form
  const [showAddProp, setShowAddProp] = useState(false)
  const [propForm, setPropForm] = useState({ name: '', api_name: '', data_type: 'string' })

  const createProperty = useMutation({
    mutationFn: (data: any) => api.post('/ontology/properties', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', typeId] })
      setShowAddProp(false)
      setPropForm({ name: '', api_name: '', data_type: 'string' })
    },
  })

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
                createProperty.mutate({ ...propForm, object_type_id: typeId })
              }}
              className="mb-4 space-y-2 p-3 bg-gray-50 rounded-lg"
            >
              <input
                placeholder="Property name"
                value={propForm.name}
                onChange={(e) => setPropForm({ ...propForm, name: e.target.value, api_name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                required
              />
              <select
                value={propForm.data_type}
                onChange={(e) => setPropForm({ ...propForm, data_type: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                {['string', 'integer', 'float', 'boolean', 'date', 'timestamp'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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
                  <span className="ml-2 text-xs text-gray-400 font-mono">{p.data_type}</span>
                </div>
                {p.is_required && <span className="text-xs text-red-400">required</span>}
              </div>
            ))}
            {properties?.length === 0 && (
              <p className="text-sm text-gray-400">No properties defined.</p>
            )}
          </div>
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
                  <input
                    value={newProps[p.api_name] ?? ''}
                    onChange={(e) => setNewProps({ ...newProps, [p.api_name]: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                    required={p.is_required}
                  />
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
                {Object.entries(selectedObject.properties).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <div className="text-gray-500 font-medium text-xs uppercase">{key}</div>
                    <div className="mt-0.5">{String(value)}</div>
                  </div>
                ))}
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
