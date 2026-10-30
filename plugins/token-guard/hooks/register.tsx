import type { Register } from 'claude-code'

// קבצים גדולים שאסור לקרוא בלי offset/limit
const BIG = /(^|\/)(index\.html|STATUS\.md|DECISIONS\.md|BACKLOG\.md)$/
const WARN_AT = 70

export const register: Register = on => {
  let warned = false

  on('session.measure', ($, e, next) => {
    const pct = e.context.percent
    const usd = e.cost?.usd
    const parts: string[] = []
    if (pct !== undefined) parts.push('הקשר ' + pct + '%')
    if (usd !== undefined) parts.push('$' + usd.toFixed(2))
    $.ui.status(parts.length ? parts.join(' | ') : undefined)
    if (pct !== undefined && pct >= WARN_AT && !warned) {
      warned = true
      $.ui.toast('ההקשר ' + pct + '% מלא, כדאי handoff ושיחה חדשה')
    }
    return next(e)
  })

  on('tool.call', { tool: 'Read' }, ($, e, next) =>
    BIG.test(e.file_path) && e.offset === undefined && e.limit === undefined
      ? { deny: 'קובץ גדול: להשתמש ב-grep או ב-Read עם offset ו-limit, לא לקרוא אותו כולו (' + e.file_path + ')' }
      : next(e),
  )
}
