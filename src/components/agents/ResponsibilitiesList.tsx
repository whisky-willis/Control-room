import { CheckCircle2, ClipboardList } from 'lucide-react'

interface ResponsibilitiesListProps {
  responsibilities: string[]
}

export function ResponsibilitiesList({ responsibilities }: ResponsibilitiesListProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-brand-500" />
        Core Responsibilities
      </h3>
      {responsibilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No responsibilities extracted from system prompt.</p>
      ) : (
        <ul className="space-y-2.5">
          {responsibilities.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-sm text-foreground leading-snug">{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
