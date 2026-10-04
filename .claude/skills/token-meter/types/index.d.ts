export type Totals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  turns: number
}

export type LastTurn = { input: number; output: number; model: string } | null

export type Meter = {
  contextTokens: number | null
  contextWindow: number
  contextPercent: number | null
  usd: number | null
  limits: { kind: string; percentUsed: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    'token-meter': {
      totals: Totals
      last: LastTurn
      meter: Meter | null
      isHidden: boolean
      messages: number
      warned: number
    }
  }
}
