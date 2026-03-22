import type { Metadata } from 'next'
import './globals.css'
import { AppSidebar } from '@/components/layout/AppSidebar'

export const metadata: Metadata = {
  title: 'Control Room — AI Agent Dashboard',
  description: 'Workday for AI Agents. Monitor, manage, and visualize your AI agent workforce.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-auto bg-background">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
