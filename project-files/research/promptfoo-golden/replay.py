"""promptfoo provider that replays saved answers instead of calling a model (no cost, no key).
ANSWERS points to {"g1": "<answer>", ...}; the test's vars.id picks the answer."""
import json, os


def call_api(prompt, options, context):
    path = os.environ.get("ANSWERS", "")
    if not path:
        return {"error": "ANSWERS is not set"}
    ans = json.load(open(path, encoding="utf-8"))
    return {"output": str(ans.get(context["vars"]["id"]) or "")}
