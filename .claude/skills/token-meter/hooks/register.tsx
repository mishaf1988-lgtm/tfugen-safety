import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register, SessionMeasureInput, SessionUsage, StateDollar } from 'claude-code'

import type { LastTurn, Meter, Totals } from '../types'

const ZERO: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 }

const totals = atom({ plugin: 'token-meter', key: 'totals' } as const, ZERO)
const last = atom({ plugin: 'token-meter', key: 'last' } as const, null as LastTurn)
const meter = atom({ plugin: 'token-meter', key: 'meter' } as const, null as Meter | null)
const isHidden = atom({ plugin: 'token-meter', key: 'isHidden' } as const, false)
const messages = atom({ plugin: 'token-meter', key: 'messages' } as const, 0)
const warned = atom({ plugin: 'token-meter', key: 'warned' } as const, 0)
const skillPath = atom({ plugin: 'token-meter', key: 'skillPath' } as const, '')

// Sends "update skill" only with a path (04/10/2026: the bare button sent an empty request three times)
const submitSkill = async ($: StateDollar & Pick<CoreEngineInterface, 'ui' | 'prompt'>, value: string) => {
  const path = value.trim().replace(/^"+|"+$/g, '')
  if (!path) {
    $.ui.toast('קודם להדביק בשדה את הנתיב של קובץ הסקיל')

    return
  }
  await update($, skillPath, () => '')
  void $.prompt.submit({ text: `עדכן סקיל: ${path}`, asUser: true })
}

// Wrapped in a left-to-right isolate so "67.7k" stays whole inside Hebrew text
const fmt = (n: number) =>
  '⁦' +
  (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`) +
  '⁩'

const bar = (pct: number | null, width = 20) => {
  const filled = Math.round((Math.min(100, Math.max(0, pct ?? 0)) / 100) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const LIMIT_NAMES: Record<string, string> = { five_hour: '5 שעות', seven_day: 'שבוע', spend_limit: 'תקציב' }

const statusText = (m: Meter, t: Totals) =>
  [
    `הקשר ${m.contextPercent ?? 0}%`,
    `נכנס ${fmt(t.input + t.cacheRead + t.cacheWrite)} · יצא ${fmt(t.output)}`,
    m.usd != null ? `$${m.usd.toFixed(2)}` : '',
    ...m.limits.map(r => `${LIMIT_NAMES[r.kind] ?? r.kind} ${r.percentUsed}%`),
  ]
    .filter(Boolean)
    .join(' | ')

// How full the chat is, by context fill and number of messages
const chatLevel = (pct: number | null, msgs: number) => {
  const p = pct ?? 0
  if (p >= 85 || msgs >= 80) return 2
  if (p >= 65 || msgs >= 50) return 1

  return 0
}

const LEVELS = [
  { text: 'תקין', color: 'green' },
  { text: 'מתמלא, כדאי לסכם בקרוב', color: 'yellow' },
  { text: 'עמוס! מומלץ לעבור לצ׳אט חדש', color: 'red' },
] as const

const warnIfNeeded = async ($: StateDollar & Pick<CoreEngineInterface, 'ui'>, m: Meter | null) => {
  const level = chatLevel(m?.contextPercent ?? null, await read($, messages))
  const before = await read($, warned)
  if (level > before) {
    $.ui.toast(level === 2 ? 'הצ׳אט עמוס, מומלץ לעבור לצ׳אט חדש' : 'הצ׳אט מתמלא, כדאי להתחיל לסכם')
  }
  await update($, warned, () => level)
}

const toMeter = (u: SessionUsage | SessionMeasureInput): Meter => ({
  contextTokens: u.context.tokens ?? null,
  contextWindow: u.context.window,
  contextPercent: u.context.percent ?? null,
  usd: u.cost?.usd ?? null,
  limits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed })),
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tokens', description: 'הצג או הסתר את שורת צריכת הטוקנים' })
    await update($, meter, () => null)
    const u = await $.session.usage()
    await update($, meter, () => toMeter(u))
    $.ui.status(statusText(toMeter(u), await read($, totals)))

    return next(e)
  })

  on('command.run', { command: 'tokens' }, async $ => {
    const hidden = await update($, isHidden, h => !h)

    return { text: hidden ? 'שורת הטוקנים הוסתרה. /tokens כדי להציג שוב.' : 'שורת הטוקנים מוצגת.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, messages, n => n + 1)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, meter, () => toMeter(e))
    await warnIfNeeded($, toMeter(e))
    $.ui.status(statusText(toMeter(e), await read($, totals)))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    if (u) {
      await update($, totals, t => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
        turns: t.turns + (e.agentId ? 0 : 1),
      }))
      if (!e.agentId) {
        await update($, last, () => ({
          input: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens,
          output: u.output_tokens,
          model: u.model,
        }))
      }
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const t = await read($, totals)
    const l = await read($, last)
    const m = await read($, meter)
    const msgs = await read($, messages)
    const path = await read($, skillPath)
    const level = chatLevel(m?.contextPercent ?? null, msgs)
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    // The phone app has no Input (05/10/2026: the whole band was refused there), so
    // the skill-path row is left out on mobile and the rest of the band still draws.
    const Input = 'Input' in ui ? ui.Input : null

    const pct = m?.contextPercent ?? null
    const ctxColor = pct === null ? undefined : pct >= 85 ? 'red' : pct >= 60 ? 'yellow' : 'green'
    const allIn = t.input + t.cacheRead + t.cacheWrite

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>צריכת טוקנים</Text>
          <Button key="hide" label="הסתר" onPress={() => update($, isHidden, () => true)} />
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>הקשר  </Text>
          <Text color={ctxColor}>{bar(pct)}</Text>
          <Text color={ctxColor} bold>
            {pct !== null ? `${pct}%` : '—'}
          </Text>
          <Text dimColor>
            {m?.contextTokens != null ? `(${fmt(m.contextTokens)} מתוך ${fmt(m.contextWindow)})` : ''}
          </Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>גודל הצ׳אט </Text>
          <Text>{msgs} הודעות</Text>
          <Text color={LEVELS[level].color} bold>
            ● {LEVELS[level].text}
          </Text>
        </Box>
        {(m?.limits ?? []).map(r => (
          <Box key={r.kind} flexDirection="row" gap={1}>
            <Text dimColor>{(LIMIT_NAMES[r.kind] ?? r.kind).padEnd(6)}</Text>
            <Text color={r.percentUsed >= 80 ? 'red' : r.percentUsed >= 50 ? 'yellow' : 'cyan'}>
              {bar(r.percentUsed)}
            </Text>
            <Text bold>{r.percentUsed}%</Text>
          </Box>
        ))}
        {Input && <Box flexDirection="row" gap={1} alignItems="center">
          <Text dimColor>עדכון סקיל </Text>
          <Box flexGrow={1}>
            <Input
              key="skill-path"
              placeholder="גרור לכאן קובץ סקיל או הדבק נתיב, ואז Enter"
              submitLabel="עדכן"
              value={path}
              onInput={value => void update($, skillPath, () => value)}
              onSubmit={value => void submitSkill($, value)}
            />
          </Box>
          <Button key="update-skill" label="עדכן סקיל" onPress={() => void submitSkill($, path)} />
        </Box>}
        <Box flexDirection="row" flexWrap="wrap" gap={2}>
          <Text>
            <Text dimColor>שיחה: </Text>
            נכנס {fmt(allIn)} · יצא {fmt(t.output)}
            <Text dimColor> (מטמון {fmt(t.cacheRead)})</Text>
          </Text>
          {l && (
            <Text>
              <Text dimColor>סבב אחרון: </Text>
              {fmt(l.input)} → {fmt(l.output)}
            </Text>
          )}
          {m?.usd != null && (
            <Text>
              <Text dimColor>עלות: </Text>
              <Text bold>{'⁦'}${m.usd.toFixed(2)}{'⁩'}</Text>
            </Text>
          )}
        </Box>
      </Box>
    )
  })
}
