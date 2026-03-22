import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface TopBarProps {
  breadcrumbs: BreadcrumbItem[]
  actions?: React.ReactNode
}

export function TopBar({ breadcrumbs, actions }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-border shrink-0">
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">{item.label}</span>
            ) : (
              <a href={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {item.label}
              </a>
            )}
          </span>
        ))}
      </nav>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
