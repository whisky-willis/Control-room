'use client'

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Agent, Workflow } from '@/lib/types'
import { AgentNode } from './AgentNode'

const nodeTypes = { agentNode: AgentNode }

interface WorkflowGraphProps {
  workflow: Workflow
  agents: Agent[]
}

function buildLayout(
  workflow: Workflow,
  agentsMap: Map<string, Agent>,
): { nodes: Node[]; edges: Edge[] } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(workflow.agents.length)))
  const NODE_W = 170
  const NODE_H = 90
  const GAP_X = 60
  const GAP_Y = 80

  const nodes: Node[] = workflow.agents.map((agentId, i) => {
    const agent = agentsMap.get(agentId)
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      id: agentId,
      type: 'agentNode',
      position: { x: col * (NODE_W + GAP_X), y: row * (NODE_H + GAP_Y) },
      data: {
        name: agent?.name || agentId,
        role: agent?.role || 'Agent',
        model: agent?.model || '',
        avatarColor: agent?.avatarColor || '#6366f1',
      },
    }
  })

  const edges: Edge[] = workflow.edges.map((e, i) => ({
    id: `e-${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    label: e.label,
    labelStyle: { fontSize: 10, fill: '#6b7280' },
    labelBgStyle: { fill: '#f9fafb', fillOpacity: 0.9 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
    style: { stroke: '#6366f1', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 16, height: 16 },
    animated: true,
  }))

  return { nodes, edges }
}

export function WorkflowGraph({ workflow, agents }: WorkflowGraphProps) {
  const agentsMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents],
  )

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildLayout(workflow, agentsMap),
    [workflow, agentsMap],
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50)
  }, [])

  return (
    <div className="w-full h-[480px] rounded-xl border border-border overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} size={1} />
        <Controls className="!shadow-sm !border-border" />
        <MiniMap
          nodeColor={(n) => (n.data as { avatarColor?: string }).avatarColor || '#6366f1'}
          className="!border-border !shadow-sm !rounded-lg"
        />
      </ReactFlow>
    </div>
  )
}
