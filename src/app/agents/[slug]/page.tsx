import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllAgents, getAgentBySlug, getWorkflowById } from '@/lib/agent-loader'
import { getInitials } from '@/lib/avatar-utils'
import { TopBar } from '@/components/layout/TopBar'
import { CompensationPanel } from '@/components/agents/CompensationPanel'
import { ResponsibilitiesList } from '@/components/agents/ResponsibilitiesList'
import { SkillsBadges } from '@/components/agents/SkillsBadges'
import { FileCode, GitBranch, ExternalLink } from 'lucide-react'

interface PageProps {
  params: { slug: string }
}

export function generateStaticParams() {
  return getAllAgents().map((a) => ({ slug: a.id }))
}

const sourceTypeLabel: Record<string, string> = {
  'claude-subagent': 'Claude Sub-agent',
  'claude-main': 'Claude Main Config',
  openai: 'OpenAI Assistant',
  langchain: 'LangChain Agent',
  generic: 'Generic Agent',
}

export default function AgentProfilePage({ params }: PageProps) {
  const agent = getAgentBySlug(params.slug)
  if (!agent) notFound()

  const workflows = agent.workflowIds
    .map((id) => getWorkflowById(id))
    .filter(Boolean)

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Agents', href: '/agents' },
          { label: agent.name },
        ]}
      />
      <div className="flex-1 p-6 max-w-5xl">
        {/* Profile header */}
        <div className="bg-white rounded-xl border border-border p-6 mb-5">
          <div className="flex items-start gap-5">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl text-white text-xl font-bold shrink-0"
              style={{ backgroundColor: agent.avatarColor || '#6366f1' }}
            >
              {getInitials(agent.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{agent.role}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="px-2.5 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-md text-xs font-medium">
                  {agent.model}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileCode className="w-3.5 h-3.5" />
                  {sourceTypeLabel[agent.sourceType] || 'Agent'}
                </span>
                <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                  {agent.sourceFile}
                </span>
              </div>
              {agent.description && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{agent.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Three-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">
            <ResponsibilitiesList responsibilities={agent.responsibilities} />
            <SkillsBadges skills={agent.skills} tools={agent.tools} />

            {/* System prompt */}
            {agent.systemPrompt && (
              <div className="bg-white rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-muted-foreground" />
                  System Prompt
                </h3>
                <pre className="text-xs text-muted-foreground bg-secondary rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {agent.systemPrompt}
                </pre>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <CompensationPanel agent={agent} />

            {/* Workflows */}
            {workflows.length > 0 && (
              <div className="bg-white rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-violet-500" />
                  Workflows
                </h3>
                <div className="space-y-2">
                  {workflows.map((wf) => wf && (
                    <Link
                      key={wf.id}
                      href={`/workflows#${wf.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-medium text-foreground group-hover:text-brand-600 transition-colors">
                          {wf.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{wf.agents.length} agents</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
