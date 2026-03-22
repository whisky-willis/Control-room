/** Cost in USD per 1M tokens */
interface ModelPricing {
  inputPer1M: number
  outputPer1M: number
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude
  'claude-opus-4-6': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-sonnet-4-6': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-haiku-4-5-20251001': { inputPer1M: 0.8, outputPer1M: 4.0 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4.0 },
  'claude-3-opus-20240229': { inputPer1M: 15.0, outputPer1M: 75.0 },
  // OpenAI GPT
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },
  // Google Gemini
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.0 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
}

const DEFAULT_PRICING: ModelPricing = { inputPer1M: 3.0, outputPer1M: 15.0 }

export function getPricing(model: string): ModelPricing {
  // Exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]
  // Partial match (handle version suffixes)
  const key = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k) || k.startsWith(model))
  return key ? MODEL_PRICING[key] : DEFAULT_PRICING
}

export function calculateCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = getPricing(model)
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  return Math.round(cost * 10000) / 10000
}
