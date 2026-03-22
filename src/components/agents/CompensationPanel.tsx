'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Agent } from '@/lib/types'
import { formatNumber, formatCost } from '@/lib/utils'
import { Zap, DollarSign, ArrowDown, ArrowUp } from 'lucide-react'

interface CompensationPanelProps {
  agent: Agent
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
        {compensation.period && (
          <span className="ml-auto text-xs font-normal text-muted-foreground">{compensation.period}</span>
        )}
      </h3>

      {!hasCost ? (
        <p className="text-sm text-muted-foreground">
          No usage data yet. Run{' '}
          <code className="text-xs bg-secondary px-1 py-0.5 rounded">npm run import-usage</code> to import API logs.
        </p>
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
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Model</span>
                <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded">{model}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
