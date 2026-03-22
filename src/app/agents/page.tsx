import { getAllAgents } from '@/lib/agent-loader'
import { AgentCard } from '@/components/agents/AgentCard'
import { TopBar } from '@/components/layout/TopBar'
import { Users } from 'lucide-react'

export default function AgentsPage() {
  const agents = getAllAgents()

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Agents' }]}
      />
      <div className="flex-1 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-brand-500" />
          <h1 className="text-xl font-bold text-foreground">Agent Directory</h1>
          <span className="ml-2 px-2 py-0.5 bg-secondary text-muted-foreground rounded-full text-xs font-medium">
            {agents.length}
          </span>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium">No agents discovered yet</p>
            <p className="text-sm mt-1">
              Run <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">npm run scan</code> to discover agents in your project.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
