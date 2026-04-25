import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { ObjectType, LinkType } from '../api/types'
import { Share2, Network } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { data: objectTypes } = useQuery({ queryKey: ['objectTypes'], queryFn: () => api.get<ObjectType[]>('/ontology/object-types') })
  const { data: linkTypes } = useQuery({ queryKey: ['linkTypes'], queryFn: () => api.get<LinkType[]>('/ontology/link-types') })

  const stats = [
    { label: 'Object Types', value: objectTypes?.length ?? 0, icon: Share2, color: 'bg-purple-500', href: '/ontology' },
    { label: 'Link Types', value: linkTypes?.length ?? 0, icon: Network, color: 'bg-blue-500', href: '/ontology' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.href}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{stat.label}</span>
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-semibold mb-4">Ontology Object Types</h2>
        {objectTypes?.length === 0 ? (
          <p className="text-gray-400 text-sm">No object types defined yet.</p>
        ) : (
          <div className="space-y-3">
            {objectTypes?.slice(0, 8).map((ot) => (
              <Link key={ot.id} to={`/ontology/explorer/${ot.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: ot.color }}>
                  {ot.name[0]}
                </div>
                <div>
                  <div className="font-medium">{ot.name}</div>
                  <div className="text-sm text-gray-500">{ot.api_name}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
