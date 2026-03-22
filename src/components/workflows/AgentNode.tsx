'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { getInitials } from '@/lib/avatar-utils'

export interface AgentNodeData {
  name: string
  role: string
  model: string
  avatarColor: string
  [key: string]: unknown
}

export function AgentNode({ data, selected }: NodeProps) {
  const nodeData = data as AgentNodeData
  return (
    <div
      className={`bg-white rounded-xl border-2 p-3 shadow-sm min-w-[140px] transition-all ${
        selected ? 'border-brand-500 shadow-brand-100' : 'border-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-brand-400 !border-white !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: nodeData.avatarColor || '#6366f1' }}
        >
          {getInitials(nodeData.name)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight truncate">{nodeData.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{nodeData.role}</p>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-brand-400 !border-white !w-2.5 !h-2.5" />
    </div>
  )
}
