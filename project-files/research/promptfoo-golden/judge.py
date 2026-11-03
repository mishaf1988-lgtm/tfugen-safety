"""promptfoo python assertions for the golden questions: the judge is tools/golden-check.py itself."""
import importlib.util, json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
_spec = importlib.util.spec_from_file_location("golden_check", os.path.join(ROOT, "tools", "golden-check.py"))
gc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gc)
GOLD = {q["id"]: q for q in json.load(open(os.path.join(ROOT, "project-files/assistant-golden.json"), encoding="utf-8"))["questions"]}


def gold(output, context):
    why = gc.judge(GOLD[context["vars"]["id"]], output)
    return {"pass": not why, "score": 0 if why else 1, "reason": "; ".join(why) or "ok"}


def hebrew(output, context):
    why = gc.hebrew_style(output) if str(output or "").strip() else ["no answer"]
    return {"pass": not why, "score": 0 if why else 1, "reason": "; ".join(why) or "ok"}
