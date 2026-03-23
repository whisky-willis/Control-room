import type { ActivitySession } from '@/lib/types'
import { Zap, Radio } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface ActivityFeedProps {
  sessions: ActivitySession[]
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ActivityFeed({ sessions }: ActivityFeedProps) {
  if (sessions.length === 0) return null

  const hasActive = sessions.some((s) => s.isActive)

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Radio className="w-4 h-4 text-brand-500" />
        Recent Activity
        {hasActive && (
          <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        )}
      </h3>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.sessionId}
            className={`flex items-center gap-3 p-2.5 rounded-lg text-xs ${
              session.isActive ? 'bg-emerald-50 border border-emerald-100' : 'bg-secondary'
            }`}
          >
            {/* Status dot */}
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                session.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
              }`}
            />

            {/* Session info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {session.agentTypesInvolved.length > 0 ? (
                  session.agentTypesInvolved.map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 bg-white border border-border rounded text-[10px] font-medium"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">Main session</span>
                )}
              </div>
            </div>

            {/* Tokens */}
            {session.totalTokens > 0 && (
              <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
                <Zap className="w-3 h-3" />
                {formatNumber(session.totalTokens)}
              </span>
            )}

            {/* Time */}
            <span className="text-muted-foreground shrink-0">{timeAgo(session.lastActiveAt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
