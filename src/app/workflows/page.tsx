import { getAllAgents, getAllWorkflows } from '@/lib/agent-loader'
import { TopBar } from '@/components/layout/TopBar'
import { WorkflowGraph } from '@/components/workflows/WorkflowGraph'
import { GitBranch, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function WorkflowsPage() {
  const workflows = getAllWorkflows()
  const agents = getAllAgents()

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Workflows' }]}
      />
      <div className="flex-1 p-6 space-y-8">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-violet-500" />
          <h1 className="text-xl font-bold text-foreground">Workflows</h1>
          <span className="ml-2 px-2 py-0.5 bg-secondary text-muted-foreground rounded-full text-xs font-medium">
            {workflows.length}
          </span>
        </div>

        {workflows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium">No workflows defined</p>
            <p className="text-sm mt-1">
              Add workflows to{' '}
              <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">control-room.config.json</code>
            </p>
          </div>
        ) : (
          workflows.map((workflow) => {
            const workflowAgents = agents.filter((a) => workflow.agents.includes(a.id))
            // Include any agents referenced in edges that may not be in agents list
            const allAgentIds = new Set([
              ...workflow.agents,
              ...workflow.edges.flatMap((e) => [e.from, e.to]),
            ])

            return (
              <section key={workflow.id} id={workflow.id} className="scroll-mt-6">
                {/* Workflow header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-foreground">{workflow.name}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{workflow.description}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {allAgentIds.size} agents
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowRight className="w-3.5 h-3.5" /> {workflow.edges.length} connections
                    </span>
                  </div>
                </div>

                {/* Graph */}
                <WorkflowGraph workflow={workflow} agents={agents} />

                {/* Agent list for this workflow */}
                {workflowAgents.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {workflowAgents.map((agent) => (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.id}`}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-lg hover:border-brand-300 transition-colors text-sm"
                      >
                        <div
                          className="w-5 h-5 rounded-full shrink-0"
                          style={{ backgroundColor: agent.avatarColor || '#6366f1' }}
                        />
                        <span className="font-medium text-foreground text-xs">{agent.name}</span>
                        <span className="text-muted-foreground text-xs">{agent.role}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
    </>
  )
}
