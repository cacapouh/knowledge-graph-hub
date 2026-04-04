import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Pipeline, Project } from '../api/types'
import { Plus, GitBranch, Play } from 'lucide-react'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-red-100 text-red-600',
}

export default function Pipelines() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState<number | ''>('')

  const { data: pipelines, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>('/pipelines'),
  })

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; project_id: number }) =>
      api.post<Pipeline>('/pipelines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      setShowForm(false)
      setName('')
      setDescription('')
      setProjectId('')
    },
  })

  const triggerRun = useMutation({
    mutationFn: (pipelineId: number) => api.post(`/pipelines/${pipelineId}/run`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipelines'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pipelines</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-foundry-600 text-white rounded-lg text-sm font-medium hover:bg-foundry-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Pipeline
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-foundry-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-foundry-500 outline-none" required>
              <option value="">Select...</option>
              {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-foundry-500 outline-none" rows={2} />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-foundry-600 text-white rounded-lg text-sm font-medium hover:bg-foundry-700 disabled:opacity-50">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-gray-400">Loading...</div>
      ) : pipelines?.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No pipelines yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines?.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <GitBranch className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm text-gray-500">{p.description || 'No description'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.status}
                </span>
                <button
                  onClick={() => triggerRun.mutate(p.id)}
                  className="p-2 text-gray-400 hover:text-foundry-600 transition-colors"
                  title="Run pipeline"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
