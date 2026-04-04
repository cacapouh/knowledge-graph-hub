import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Project, Dataset, ObjectType, Pipeline } from '../api/types'
import { Database, Share2, GitBranch } from 'lucide-react'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`/projects/${projectId}`),
  })

  const { data: datasets } = useQuery({
    queryKey: ['datasets', { projectId }],
    queryFn: () => api.get<Dataset[]>(`/datasets?project_id=${projectId}`),
  })

  const { data: objectTypes } = useQuery({
    queryKey: ['objectTypes', { projectId }],
    queryFn: () => api.get<ObjectType[]>(`/ontology/object-types?project_id=${projectId}`),
  })

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines', { projectId }],
    queryFn: () => api.get<Pipeline[]>(`/pipelines?project_id=${projectId}`),
  })

  if (!project) return <div className="text-gray-400">Loading...</div>

  return (
    <div>
      <div className="mb-6">
        <Link to="/projects" className="text-sm text-brand-600 hover:underline">← Projects</Link>
        <h1 className="text-2xl font-bold mt-2">{project.name}</h1>
        <p className="text-gray-500 mt-1">{project.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Datasets */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold">Datasets ({datasets?.length ?? 0})</h2>
          </div>
          {datasets?.length === 0 ? (
            <p className="text-gray-400 text-sm">No datasets</p>
          ) : (
            <div className="space-y-2">
              {datasets?.map((d) => (
                <div key={d.id} className="p-2 rounded-lg bg-gray-50 text-sm">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-gray-400">{d.row_count} rows • {d.format}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Object Types */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold">Object Types ({objectTypes?.length ?? 0})</h2>
          </div>
          {objectTypes?.length === 0 ? (
            <p className="text-gray-400 text-sm">No object types</p>
          ) : (
            <div className="space-y-2">
              {objectTypes?.map((ot) => (
                <Link key={ot.id} to={`/ontology/explorer/${ot.id}`} className="block p-2 rounded-lg bg-gray-50 text-sm hover:bg-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded text-white text-xs flex items-center justify-center font-bold" style={{ backgroundColor: ot.color }}>
                      {ot.name[0]}
                    </div>
                    <span className="font-medium">{ot.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pipelines */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold">Pipelines ({pipelines?.length ?? 0})</h2>
          </div>
          {pipelines?.length === 0 ? (
            <p className="text-gray-400 text-sm">No pipelines</p>
          ) : (
            <div className="space-y-2">
              {pipelines?.map((p) => (
                <div key={p.id} className="p-2 rounded-lg bg-gray-50 text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
