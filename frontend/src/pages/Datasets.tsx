import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Dataset, Project } from '../api/types'
import { Plus, Database } from 'lucide-react'

export default function Datasets() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState<number | ''>('')

  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.get<Dataset[]>('/datasets'),
  })

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; project_id: number }) =>
      api.post<Dataset>('/datasets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      setShowForm(false)
      setName('')
      setDescription('')
      setProjectId('')
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Datasets</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-foundry-600 text-white rounded-lg text-sm font-medium hover:bg-foundry-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Dataset
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (projectId === '') return
            createMutation.mutate({ name, description, project_id: projectId })
          }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dataset Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-foundry-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-foundry-500 outline-none"
              required
            >
              <option value="">Select a project...</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-foundry-500 outline-none"
              rows={2}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-foundry-600 text-white rounded-lg text-sm font-medium hover:bg-foundry-700 disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-gray-400">Loading...</div>
      ) : datasets?.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No datasets yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Format</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Rows</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {datasets?.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-gray-400">{d.description}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{d.format}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{d.row_count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-gray-400">{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
