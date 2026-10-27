"""Unified, bounded example library. Units are micrometres unless stated."""
import json
from pathlib import Path
CATALOG = json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))["examples"]
BY_ID = {x["id"]: x for x in CATALOG}

def validate(data):
    import math
    if not isinstance(data, dict) or data.get("example") not in BY_ID:
        raise ValueError("지원하는 예제를 선택해 주세요.")
    spec = BY_ID[data["example"]]
    given = data.get("params", {})
    if not isinstance(given, dict):
        raise ValueError("조건은 숫자 형식이어야 합니다.")
    if set(given) - {f["key"] for f in spec["fields"]}:
        raise ValueError("지원하지 않는 조건이 포함되어 있습니다.")
    params = {}
    for f in spec["fields"]:
        raw = given.get(f["key"], f["default"])
        if 'options' in f:
            if isinstance(raw, bool) or raw not in f['options']:
                raise ValueError(f'{f["label"]}: 지원하지 않는 값입니다.')
            params[f['key']] = raw
            continue
        if isinstance(raw, bool):
            raise ValueError("숫자 조건을 입력해 주세요.")
        try: value = float(raw)
        except (TypeError, ValueError): raise ValueError(f'{f["label"]}: 숫자를 입력해 주세요.')
        if not math.isfinite(value) or not f["min"] <= value <= f["max"]:
            raise ValueError(f'{f["label"]}: {f["min"]}~{f["max"]} 범위로 입력해 주세요.')
        if f["key"] in ("cycles", "layers", "sheets") and value != int(value):
            raise ValueError("횟수는 정수여야 합니다.")
        params[f["key"]] = value
    return spec, params
