#!/usr/bin/env python3
"""List the scheduled agents that run without a model set (24/11/2026, Michael in the questionnaire: "do it: a checker
for a trigger with no model"; handoff 24/11/2026 idea 4). A trigger with an empty model runs on the account default
(Fable, the most expensive), and on 24/11/2026 the coach was found that way by hand among 37 triggers.

Reads the shared agents_registry (state_get; written by the weekly quota measurement from list_triggers, each agent has
`model` = derived_state.model or empty). One-shot reminders (no cron) are skipped, and so is an agent with `persistent: true` (a trigger that fires into a standing
session runs on that session's model, so an empty model there is normal). The registry is weekly, so the age is
printed: an empty model on an old registry may already be fixed, check it with get_trigger before changing anything.

Usage: python3 tools/trigger-models.py
Exit 0 = every recurring trigger has a model, 1 = some do not (printed), 3 = no ROUTINE_KEY, 4 = the server did not answer.
Who runs it: the quality checker (routine-quality.md 2ג); any session that wants the list.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'project-files', 'routine-db.sh')


def missing(registry):
    """Enabled recurring triggers whose model is empty."""
    return [a for a in registry.get('agents', [])
            if a.get('enabled') and (a.get('cron') or '').strip() and not (a.get('model') or '').strip()
            and not a.get('persistent')]


def age_days(at, now=None):
    if not at:
        return None
    now = now or datetime.now(timezone.utc)
    return (now - datetime.fromisoformat(at.replace('Z', '+00:00'))).total_seconds() / 86400


def load():
    p = subprocess.run(['bash', DB, json.dumps({'op': 'state_get', 'key': 'agents_registry'})], capture_output=True, text=True)
    if p.returncode != 0:
        return p.returncode, None
    try:
        rows = json.loads(p.stdout).get('rows') or []
        return 0, json.loads(rows[0]['value'])
    except (ValueError, KeyError, IndexError):
        return 4, None


def main():
    rc, reg = load()
    if rc:
        print('no registry (exit %d)' % rc, file=sys.stderr)
        return rc
    bad = missing(reg)
    d = age_days(reg.get('at'))
    print('registry age: %s days, %d agents' % ('?' if d is None else '%.1f' % d, len(reg.get('agents', []))))
    for a in bad:
        print('NO MODEL: %s  %s  %s' % (a.get('id'), a.get('name'), a.get('cron')))
    print('%d recurring triggers without a model' % len(bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
