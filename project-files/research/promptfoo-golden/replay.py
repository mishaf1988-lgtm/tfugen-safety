"""promptfoo provider that replays saved answers instead of calling a model (no cost, no key).
The answers file is {"g1": "<answer>", ...}: the provider's config.answers (path from the repo root, used by the
comparison config) or the ANSWERS environment variable. The test's vars.id picks the answer."""
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


def call_api(prompt, options, context):
    path = ((options or {}).get("config") or {}).get("answers") or os.environ.get("ANSWERS", "")
    if not path:
        return {"error": "no answers file: set ANSWERS or config.answers"}
    ans = json.load(open(path if os.path.isabs(path) else os.path.join(ROOT, path), encoding="utf-8"))
    return {"output": str(ans.get(context["vars"]["id"]) or "")}
