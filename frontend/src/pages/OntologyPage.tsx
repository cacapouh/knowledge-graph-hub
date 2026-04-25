import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ObjectType, LinkType } from '../api/types'
import { Plus, Share2, ArrowRight, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function OntologyPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'objects' | 'links'>('objects')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', api_name: '', description: '', icon: 'cube', color: '#6366f1' })

  const { data: objectTypes } = useQuery({ queryKey: ['objectTypes'], queryFn: () => api.get<ObjectType[]>('/ontology/object-types') })
  const { data: linkTypes } = useQuery({ queryKey: ['linkTypes'], queryFn: () => api.get<LinkType[]>('/ontology/link-types') })

  const createObjectType = useMutation({
    mutationFn: (data: any) => api.post('/ontology/object-types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectTypes'] })
      setShowForm(false)
      setFormData({ name: '', api_name: '', description: '', icon: 'cube', color: '#6366f1' })
    },
  })

  const deleteObjectType = useMutation({
    mutationFn: (id: number) => api.delete(`/ontology/object-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objectTypes'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ontology</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Object Type
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('objects')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'objects' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Object Types ({objectTypes?.length ?? 0})
        </button>
        <button
          onClick={() => setTab('links')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'links' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Link Types ({linkTypes?.length ?? 0})
        </button>
      </div>

      {/* Create Object Type Form */}
      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createObjectType.mutate(formData)
          }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value, api_name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Name</label>
              <input
                value={formData.api_name}
                onChange={(e) => setFormData({ ...formData, api_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={createObjectType.isPending} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Object Types Grid */}
      {tab === 'objects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {objectTypes?.map((ot) => (
            <div key={ot.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: ot.color }}>
                    {ot.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{ot.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{ot.api_name}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteObjectType.mutate(ot.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ot.description || 'No description'}</p>
              <Link
                to={`/ontology/explorer/${ot.id}`}
                className="text-sm text-brand-600 hover:underline font-medium"
              >
                Explore Objects →
              </Link>
            </div>
          ))}
          {objectTypes?.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              <Share2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No object types defined. Create one to start building your ontology.</p>
            </div>
          )}
        </div>
      )}

      {/* Link Types List */}
      {tab === 'links' && (
        <div className="space-y-3">
          {linkTypes?.map((lt) => (
            <div key={lt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
                  {objectTypes?.find((o) => o.id === lt.source_object_type_id)?.name ?? '?'}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                  {objectTypes?.find((o) => o.id === lt.target_object_type_id)?.name ?? '?'}
                </span>
              </div>
              <div className="flex-1">
                <span className="font-medium text-sm">{lt.name}</span>
                <span className="text-xs text-gray-400 ml-2">{lt.cardinality}</span>
              </div>
            </div>
          ))}
          {linkTypes?.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No link types defined.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
