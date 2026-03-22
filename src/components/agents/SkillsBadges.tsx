import { Wrench, Brain } from 'lucide-react'

interface SkillsBadgesProps {
  skills: string[]
  tools: string[]
}

export function SkillsBadges({ skills, tools }: SkillsBadgesProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-4">
      {skills.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
            <Brain className="w-3.5 h-3.5" /> Skills
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s}
                className="px-2 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-md text-xs font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {tools.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
            <Wrench className="w-3.5 h-3.5" /> Tools
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {tools.map((t) => (
              <span
                key={t}
                className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-mono"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {skills.length === 0 && tools.length === 0 && (
        <p className="text-sm text-muted-foreground">No skills or tools detected.</p>
      )}
    </div>
  )
}
