'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Agent } from '@/lib/types'
import { formatNumber, formatCost } from '@/lib/utils'

interface CostOverviewChartProps {
  agents: Agent[]
}

export function CostOverviewChart({ agents }: CostOverviewChartProps) {
  const data = agents
    .map((a) => ({
      name: a.name.length > 14 ? a.name.slice(0, 12) + '…' : a.name,
      tokens: a.compensation.totalTokens,
      cost: a.compensation.estimatedCostUSD,
      color: a.avatarColor || '#6366f1',
    }))
    .sort((a, b) => b.tokens - a.tokens)

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Token Usage by Agent</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatNumber(v)}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'tokens' ? formatNumber(value) : formatCost(value),
              name === 'tokens' ? 'Tokens' : 'Cost',
            ]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="tokens" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
