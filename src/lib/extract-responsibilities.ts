/**
 * Extracts core responsibilities from an agent's system prompt.
 * Looks for bullet points, numbered lists, and "your job is to..." patterns.
 */
export function extractResponsibilities(systemPrompt: string): string[] {
  if (!systemPrompt) return []

  const lines = systemPrompt.split('\n').map((l) => l.trim())
  const responsibilities: string[] = []

  // Pattern 1: Markdown bullet points (-, *, •)
  const bulletPattern = /^[-*•]\s+(.+)/
  // Pattern 2: Numbered lists (1. 2. etc)
  const numberedPattern = /^\d+[.)]\s+(.+)/

  // Sections that likely contain responsibilities
  const responsibilityHeaders = [
    'responsibilities',
    'your role',
    'your job',
    'you will',
    'you are responsible',
    'primary duties',
    'core tasks',
    'main tasks',
    'objectives',
    'your purpose',
  ]

  let inResponsibilitySection = false

  for (const line of lines) {
    const lower = line.toLowerCase()

    // Check if we hit a responsibility section header
    if (responsibilityHeaders.some((h) => lower.includes(h))) {
      inResponsibilitySection = true
      continue
    }

    // Stop at next major section (markdown heading)
    if (line.startsWith('#') && inResponsibilitySection && responsibilities.length > 0) {
      inResponsibilitySection = false
    }

    const bulletMatch = line.match(bulletPattern)
    const numberedMatch = line.match(numberedPattern)

    if (bulletMatch || numberedMatch) {
      const text = (bulletMatch?.[1] || numberedMatch?.[1] || '').trim()
      if (text.length > 10 && text.length < 200) {
        // Avoid collecting tool definitions or config
        if (!text.includes('(') || !text.includes(')') || inResponsibilitySection) {
          responsibilities.push(text)
        }
      }
    }
  }

  // Fallback: extract first 3 sentences as responsibilities
  if (responsibilities.length === 0) {
    const sentences = systemPrompt
      .replace(/\n+/g, ' ')
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 200)
      .slice(0, 3)
    return sentences
  }

  return responsibilities.slice(0, 10)
}

/**
 * Extracts skill keywords from a system prompt.
 */
export function extractSkills(systemPrompt: string, tools: string[]): string[] {
  const skillKeywords = [
    'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'C#', 'Ruby',
    'React', 'Next.js', 'Node.js', 'FastAPI', 'Django', 'Flask',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
    'Git', 'GitHub', 'CI/CD', 'DevOps',
    'REST API', 'GraphQL', 'gRPC',
    'testing', 'debugging', 'code review', 'refactoring',
    'research', 'analysis', 'writing', 'editing', 'summarization',
    'data analysis', 'machine learning', 'NLP',
    'web search', 'file management', 'shell commands',
  ]

  const found = new Set<string>()
  const lower = systemPrompt.toLowerCase()

  for (const skill of skillKeywords) {
    if (lower.includes(skill.toLowerCase())) {
      found.add(skill)
    }
  }

  // Add tools as skills
  for (const tool of tools) {
    const clean = tool.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
    found.add(clean)
  }

  return Array.from(found).slice(0, 12)
}
