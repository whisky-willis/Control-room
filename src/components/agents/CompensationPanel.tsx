'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Agent } from '@/lib/types'
import { formatNumber, formatCost } from '@/lib/utils'
import { Zap, DollarSign, ArrowDown, ArrowUp, Clock } from 'lucide-react'

interface CompensationPanelProps {
  agent: Agent
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

export function CompensationPanel({ agent }: CompensationPanelProps) {
  const { compensation, model } = agent
  const hasCost = compensation.estimatedCostUSD > 0 || compensation.totalTokens > 0

  const pieData = [
    { name: 'Input', value: compensation.inputTokens, color: '#6366f1' },
    { name: 'Output', value: compensation.outputTokens, color: '#8b5cf6' },
  ]

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-emerald-500" />
        Compensation
        {compensation.isActive && (
          <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        )}
        {compensation.period && (
          <span className="ml-auto text-xs font-normal text-muted-foreground">{compensation.period}</span>
        )}
      </h3>

      {!hasCost ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">No usage data yet.</p>
          <p className="text-xs text-muted-foreground">
            Run <code className="bg-secondary px-1 py-0.5 rounded">npm run scan</code> to read Claude Code session logs automatically,
            or set up an{' '}
            <a
              href="https://console.anthropic.com/settings/organization"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline underline-offset-2"
            >
              Anthropic organization
            </a>{' '}
            for live API usage data.
          </p>
        </div>
      ) : (
        <>
          {/* Big numbers */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Total Tokens
              </p>
              <p className="text-xl font-bold text-foreground mt-1">
                {formatNumber(compensation.totalTokens)}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-500" /> Est. Cost
              </p>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {formatCost(compensation.estimatedCostUSD)}
              </p>
            </div>
          </div>

          {/* Input / output breakdown */}
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <ResponsiveContainer width={80} height={80}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={24}
                    outerRadius={38}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatNumber(v)}
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowDown className="w-3 h-3 text-brand-500" /> Input tokens
                </span>
                <span className="font-medium">{formatNumber(compensation.inputTokens)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUp className="w-3 h-3 text-violet-500" /> Output tokens
                </span>
                <span className="font-medium">{formatNumber(compensation.outputTokens)}</span>
              </div>
              {(compensation.cacheTokens ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="w-3 h-3 text-amber-400" /> Cache tokens
                  </span>
                  <span className="font-medium">{formatNumber(compensation.cacheTokens!)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Model</span>
                <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded">{model}</span>
              </div>
            </div>
          </div>

          {/* Footer: last active + session count */}
          {compensation.lastActiveAt && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last active {timeAgo(compensation.lastActiveAt)}
              </span>
              {compensation.sessionCount !== undefined && (
                <span>{compensation.sessionCount} session{compensation.sessionCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
