#!/usr/bin/env python3

from __future__ import annotations

import argparse
import ast
import copy
import hashlib
import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE_DIR = ROOT / "library" / "Lenia_ND_Studio" / "python_reference" / "raw_solitons"
DEFAULT_catalogue_2D = ROOT / "library" / "_shared" / "data" / "solitons.json"
DEFAULT_catalogue_3D = ROOT / "library" / "_shared" / "data" / "solitons3D.json"
DEFAULT_catalogue_4D = ROOT / "library" / "_shared" / "data" / "solitons4D.json"
PRESERVED_STREAM_LABELS = {"arita", "ovoid"}


@dataclass
class Candidate:
    source_file: str
    source_index: int
    dim: int
    taxonomy: list[dict[str, Any]]
    entry: dict[str, Any]
    signature: str


@dataclass
class ParseStats:
    files_scanned: int = 0
    object_records: int = 0
    python_records: int = 0
    valid_candidates: int = 0
    skipped_records: int = 0
    parse_errors: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import and normalize new soliton candidates")
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--catalogue-2d", type=Path, default=DEFAULT_catalogue_2D)
    parser.add_argument("--catalogue-3d", type=Path, default=DEFAULT_catalogue_3D)
    parser.add_argument("--catalogue-4d", type=Path, default=DEFAULT_catalogue_4D)
    parser.add_argument("--apply", action="store_true", help="Write updates to catalogue files")
    return parser.parse_args()


@dataclass
class StreamObject:
    text: str
    start: int
    end: int


def parse_stream_objects(text: str) -> list[StreamObject]:
    objects: list[StreamObject] = []
    in_string = False
    escaped = False
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start >= 0:
                objects.append(StreamObject(text=text[start : i + 1], start=start, end=i + 1))
                start = -1
    return objects


def normalize_stream_label(raw: str) -> str | None:
    label = re.sub(r"\s+", " ", raw.strip())
    if len(label) < 3 or len(label) > 48:
        return None

    # Skip RLE-like payload strings and informational lines.
    if any(ch in label for ch in ".!%#$"):
        return None
    if "leaderboard" in label.lower():
        return None

    if not re.fullmatch(r"[A-Za-z][A-Za-z +_-]*", label):
        return None

    normalized = label.lower()
    if normalized not in PRESERVED_STREAM_LABELS:
        return None
    return normalized


def extract_stream_labels(text: str) -> tuple[list[str], bool]:
    labels: list[str] = []
    saw_string = False
    for match in re.finditer(r'^\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$', text, flags=re.MULTILINE):
        saw_string = True
        label = normalize_stream_label(match.group(1))
        if label:
            labels.append(label)
    return labels, saw_string


def parse_level(code: str) -> int | None:
    m = re.match(r"^>(\d+)$", code.strip())
    if not m:
        return None
    return int(m.group(1))


def safe_eval_expr(node: ast.AST, env: dict[str, Any]) -> Any:
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.List):
        return [safe_eval_expr(item, env) for item in node.elts]
    if isinstance(node, ast.Tuple):
        return tuple(safe_eval_expr(item, env) for item in node.elts)
    if isinstance(node, ast.Dict):
        out: dict[Any, Any] = {}
        for key_node, value_node in zip(node.keys, node.values):
            key = safe_eval_expr(key_node, env)
            value = safe_eval_expr(value_node, env)
            out[key] = value
        return out
    if isinstance(node, ast.UnaryOp):
        value = safe_eval_expr(node.operand, env)
        if isinstance(node.op, ast.USub):
            return -value
        if isinstance(node.op, ast.UAdd):
            return +value
        raise ValueError("Unsupported unary operator")
    if isinstance(node, ast.BinOp):
        left = safe_eval_expr(node.left, env)
        right = safe_eval_expr(node.right, env)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / right
        raise ValueError("Unsupported binary operator")
    if isinstance(node, ast.Name):
        if node.id in env:
            return env[node.id]
        raise ValueError(f"Unknown name: {node.id}")
    if isinstance(node, ast.Subscript):
        container = safe_eval_expr(node.value, env)
        key = safe_eval_expr(node.slice, env)
        return container[key]
    raise ValueError(f"Unsupported expression node: {type(node).__name__}")


def parse_object_record(obj_text: str) -> dict[str, Any] | None:
    try:
        value = json.loads(obj_text)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        pass

    try:
        value = ast.literal_eval(obj_text)
        return value if isinstance(value, dict) else None
    except Exception:
        pass

    try:
        expr = ast.parse(obj_text, mode="eval")
        value = safe_eval_expr(expr.body, {})
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def assign_target(target: ast.AST, value: Any, env: dict[str, Any]) -> None:
    if isinstance(target, ast.Name):
        env[target.id] = value
        return
    if isinstance(target, ast.Subscript):
        container = safe_eval_expr(target.value, env)
        key = safe_eval_expr(target.slice, env)
        container[key] = value
        return
    raise ValueError(f"Unsupported assignment target: {type(target).__name__}")


def parse_python_patterns(path: Path) -> dict[str, dict[str, Any]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    env: dict[str, Any] = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        try:
            value = safe_eval_expr(node.value, env)
        except Exception:
            continue
        for target in node.targets:
            try:
                assign_target(target, copy.deepcopy(value), env)
            except Exception:
                continue

    merged: dict[str, dict[str, Any]] = {}
    for var_name in ("patterns", "pattern"):
        blob = env.get(var_name)
        if not isinstance(blob, dict):
            continue
        for key, value in blob.items():
            if isinstance(key, str) and isinstance(value, dict):
                merged[key] = value
    return merged


def normalize_number(value: Any, *, force_int: bool = False) -> Any:
    if isinstance(value, bool):
        return int(value) if force_int else value
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            return value
        if force_int:
            return int(round(value))
        if abs(value - round(value)) < 1e-12:
            return int(round(value))
        return float(f"{value:.12g}")
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return s
        try:
            if force_int:
                return int(round(float(s)))
            return normalize_number(float(s), force_int=False)
        except ValueError:
            return s
    return value


def format_b_component(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    num = normalize_number(value)
    if isinstance(num, int):
        return str(num)
    if isinstance(num, float):
        return f"{num:.12g}"
    return str(value)


def normalize_b(value: Any) -> str:
    if isinstance(value, str):
        return value.replace(" ", "")
    if isinstance(value, (list, tuple)):
        return ",".join(format_b_component(item) for item in value)
    return format_b_component(value)


def normalize_channel_pair(value: Any) -> list[int] | None:
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return [int(normalize_number(value[0], force_int=True)), int(normalize_number(value[1], force_int=True))]
    return None


def normalize_param_dict(value: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    if "R" in value:
        out["R"] = normalize_number(value["R"], force_int=True)
    if "T" in value:
        out["T"] = normalize_number(value["T"], force_int=True)

    if "b" in value:
        out["b"] = normalize_b(value["b"])

    for key in ("m", "s", "h", "r"):
        if key in value:
            out[key] = normalize_number(value[key])

    if "kn" in value:
        out["kn"] = normalize_number(value["kn"], force_int=True)
    elif "k" in value:
        out["kn"] = normalize_number(value["k"], force_int=True)

    if "gn" in value:
        out["gn"] = normalize_number(value["gn"], force_int=True)
    elif "g" in value:
        out["gn"] = normalize_number(value["g"], force_int=True)

    channel = None
    if "c" in value:
        channel = normalize_channel_pair(value["c"])
    elif "c0" in value or "c1" in value:
        channel = [
            int(normalize_number(value.get("c0", 0), force_int=True)),
            int(normalize_number(value.get("c1", 0), force_int=True)),
        ]
    if channel is not None:
        out["c"] = channel

    # Preserve uncommon keys if present and JSON-compatible.
    for key, raw in value.items():
        if key in {"R", "T", "b", "m", "s", "h", "r", "kn", "gn", "k", "g", "c", "c0", "c1"}:
            continue
        if isinstance(raw, (str, int, float, bool)) or raw is None:
            out[key] = normalize_number(raw) if isinstance(raw, (int, float, str)) else raw

    return out


def params_from_legacy_fields(record: dict[str, Any]) -> dict[str, Any] | list[dict[str, Any]] | None:
    indexed: dict[int, dict[str, Any]] = {}
    for key, value in record.items():
        match = re.fullmatch(r"([A-Za-z_]+)(\d+)", key)
        if not match:
            continue
        base = match.group(1)
        idx = int(match.group(2))
        if base in {"b", "m", "s", "h", "r", "kn", "gn", "k", "g", "c0", "c1"}:
            indexed.setdefault(idx, {})[base] = value

    if indexed:
        params: list[dict[str, Any]] = []
        for idx in sorted(indexed):
            item = dict(indexed[idx])
            if "R" in record:
                item["R"] = record["R"]
            if "T" in record:
                item["T"] = record["T"]
            params.append(normalize_param_dict(item))
        return params[0] if len(params) == 1 else params

    base: dict[str, Any] = {}
    for key in ("R", "T", "b", "m", "s", "h", "r", "kn", "gn", "k", "g", "c", "c0", "c1"):
        if key in record:
            base[key] = record[key]
    if base:
        return normalize_param_dict(base)
    return None


def params_from_kernels(record: dict[str, Any]) -> dict[str, Any] | list[dict[str, Any]] | None:
    kernels = record.get("kernels")
    if not isinstance(kernels, list):
        return None

    params: list[dict[str, Any]] = []
    for kernel in kernels:
        if not isinstance(kernel, dict):
            continue
        item = dict(kernel)
        if "R" in record:
            item["R"] = record["R"]
        if "T" in record:
            item["T"] = record["T"]
        params.append(normalize_param_dict(item))

    if not params:
        return None
    return params[0] if len(params) == 1 else params


def normalize_params(record: dict[str, Any]) -> dict[str, Any] | list[dict[str, Any]] | None:
    if "params" in record:
        raw = record["params"]
        if isinstance(raw, dict):
            return normalize_param_dict(raw)
        if isinstance(raw, list):
            params = [normalize_param_dict(item) for item in raw if isinstance(item, dict)]
            if not params:
                return None
            return params[0] if len(params) == 1 else params
    from_kernels = params_from_kernels(record)
    if from_kernels is not None:
        return from_kernels
    return params_from_legacy_fields(record)


def normalize_rle_text(value: str) -> str:
    compact = "".join(value.split())
    if not compact:
        return "!"
    if not compact.endswith("!"):
        compact += "!"
    return compact


def clamp01(value: float) -> float:
    if value < 0.0:
        return 0.0
    if value > 1.0:
        return 1.0
    return value


def token_from_byte(byte: int) -> str:
    if byte <= 0:
        return "."
    if byte >= 255:
        return "o"
    if byte < 25:
        return chr(64 + byte)
    offset = byte - 25
    prefix = chr(112 + (offset // 24))
    suffix = chr(65 + (offset % 24))
    return prefix + suffix


def encode_row(values: list[Any], width: int) -> str:
    padded = list(values) + [0.0] * max(0, width - len(values))
    out_parts: list[str] = []
    prev: str | None = None
    run = 0
    for raw in padded:
        val = normalize_number(raw)
        if isinstance(val, str):
            try:
                val = float(val)
            except ValueError:
                val = 0.0
        if isinstance(val, bool):
            val = int(val)
        if isinstance(val, int):
            val = float(val)
        if not isinstance(val, float):
            val = 0.0
        token = token_from_byte(int(round(clamp01(val) * 255)))
        if token == prev:
            run += 1
        else:
            if prev is not None:
                out_parts.append((str(run) if run > 1 else "") + prev)
            prev = token
            run = 1
    if prev is not None:
        out_parts.append((str(run) if run > 1 else "") + prev)
    return "".join(out_parts) or "."


def encode_grid_2d(grid: list[list[Any]]) -> str:
    if not grid:
        return "!"
    width = max((len(row) for row in grid), default=0)
    if width == 0:
        return "!"
    rows = [encode_row(row, width) for row in grid]
    return "$".join(rows) + "!"


def is_numeric_tensor(value: Any) -> bool:
    if isinstance(value, (int, float, bool)):
        return True
    if isinstance(value, str):
        try:
            float(value)
            return True
        except ValueError:
            return False
    if isinstance(value, (list, tuple)):
        return all(is_numeric_tensor(item) for item in value)
    return False


def tensor_depth(value: Any) -> int:
    if not isinstance(value, (list, tuple)) or not value:
        return 0
    return 1 + tensor_depth(value[0])


def encode_tensor(value: Any) -> tuple[str, int] | None:
    if not isinstance(value, (list, tuple)):
        return None
    depth = tensor_depth(value)
    if depth == 2 and is_numeric_tensor(value):
        return encode_grid_2d([list(row) for row in value]), 2
    if depth == 3 and is_numeric_tensor(value):
        z_parts = [encode_grid_2d([list(row) for row in grid]).rstrip("!") for grid in value]
        return "%".join(z_parts) + "!", 3
    if depth == 4 and is_numeric_tensor(value):
        w_parts: list[str] = []
        for volume in value:
            z_parts = [encode_grid_2d([list(row) for row in grid]).rstrip("!") for grid in volume]
            w_parts.append("%".join(z_parts))
        return "#".join(w_parts) + "!", 4
    return None


def infer_dim_from_string(text: str) -> int:
    if "#" in text:
        return 4
    if "%" in text:
        return 3
    return 2


def normalize_cells(value: Any) -> tuple[str | list[str], int] | None:
    if isinstance(value, str):
        normalized = normalize_rle_text(value)
        return normalized, infer_dim_from_string(normalized)

    encoded_tensor = encode_tensor(value)
    if encoded_tensor is not None:
        return encoded_tensor

    if isinstance(value, (list, tuple)):
        channels: list[str] = []
        dims: list[int] = []
        for item in value:
            norm = normalize_cells(item)
            if norm is None:
                return None
            cells, dim = norm
            if isinstance(cells, list):
                # Flatten one level if nested channels appear.
                channels.extend(cells)
            else:
                channels.append(cells)
            dims.append(dim)
        if not channels:
            return None
        return channels, max(dims) if dims else 2

    return None


def clean_code(code: str) -> str:
    compact = re.sub(r"\s+", "", code)
    compact = re.sub(r"[^A-Za-z0-9_>#-]", "", compact)
    return compact


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def signature_for(dim: int, params: Any, cells: Any) -> str:
    if isinstance(cells, list):
        cell_key = "|".join(normalize_rle_text(item) for item in cells)
    else:
        cell_key = normalize_rle_text(cells)
    basis = f"{dim}|{canonical_json(params)}|{cell_key}"
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()


def build_flags(record: dict[str, Any], params: Any, cells: Any, dim: int) -> dict[str, bool]:
    flags: dict[str, bool] = {}

    param_list = params if isinstance(params, list) else [params]
    if len(param_list) > 1:
        flags["multiKernel"] = True

    if dim > 2:
        flags["multidimensional"] = True

    if isinstance(cells, list) and len(cells) > 1:
        flags["multiChannel"] = True

    channel_pairs: set[tuple[int, int]] = set()
    for item in param_list:
        if not isinstance(item, dict):
            continue
        chan = item.get("c")
        if isinstance(chan, list) and len(chan) >= 2:
            pair = (int(chan[0]), int(chan[1]))
            channel_pairs.add(pair)
    if channel_pairs and (len(channel_pairs) > 1 or any(pair != (0, 0) for pair in channel_pairs)):
        flags["multiChannel"] = True

    asymptotic_keys = ("asymptotic", "asym", "asymptoticUpdate", "asymptotic_update")
    if any(bool(record.get(key)) for key in asymptotic_keys):
        flags["asymptoticUpdate"] = True
    else:
        for item in param_list:
            if not isinstance(item, dict):
                continue
            t = item.get("T")
            if isinstance(t, (int, float)) and t >= 100:
                flags["asymptoticUpdate"] = True
                break

    return flags


def merge_context_taxonomy(
    taxonomy: list[dict[str, Any]],
    context_labels: list[str],
    dim: int,
) -> list[dict[str, Any]]:
    if not context_labels:
        return copy.deepcopy(taxonomy)

    merged = copy.deepcopy(taxonomy) if taxonomy else fallback_taxonomy_headers(dim)
    existing_names = {str(entry.get("name", "")).strip().lower() for entry in merged if isinstance(entry, dict)}

    for label in context_labels:
        name = f"group: {label}"
        if name.lower() in existing_names:
            continue
        merged.append({"code": ">4", "name": name})
        existing_names.add(name.lower())

    return merged


def make_candidate(
    record: dict[str, Any],
    source_file: str,
    source_index: int,
    taxonomy: list[dict[str, Any]],
    context_labels: list[str],
) -> Candidate | None:
    params = normalize_params(record)
    if params is None:
        return None

    cells_payload = record.get("cells")
    if cells_payload is None:
        return None

    cells_norm = normalize_cells(cells_payload)
    if cells_norm is None:
        return None
    cells, dim = cells_norm
    if dim not in {2, 3, 4}:
        return None

    name = str(record.get("name", "")).strip()
    cname = str(record.get("cname", "")).strip()
    code = clean_code(str(record.get("code", "")).strip())

    provisional_sig = signature_for(dim, params, cells)
    if not code or code.startswith(">"):
        code = f"IMP{dim}_{provisional_sig[:8].upper()}"
    if not name:
        name = cname or f"Imported {code}"

    entry: dict[str, Any] = {
        "code": code,
        "name": name,
        "cname": cname,
        "params": params,
        "cells": cells,
    }
    if not cname:
        entry.pop("cname")

    flags = build_flags(record, params, cells, dim)
    entry["multiKernel"] = bool(flags.get("multiKernel", False))
    entry["multiChannel"] = bool(flags.get("multiChannel", False))
    entry["asymptoticUpdate"] = bool(flags.get("asymptoticUpdate", False))
    if flags:
        entry["flags"] = flags

    effective_taxonomy = merge_context_taxonomy(taxonomy, context_labels, dim)

    sig = signature_for(dim, entry["params"], entry["cells"])
    return Candidate(
        source_file=source_file,
        source_index=source_index,
        dim=dim,
        taxonomy=effective_taxonomy,
        entry=entry,
        signature=sig,
    )


def collect_candidates(source_dir: Path) -> tuple[list[Candidate], ParseStats]:
    stats = ParseStats()
    candidates: list[Candidate] = []

    for path in sorted(source_dir.iterdir()):
        if not path.is_file():
            continue
        stats.files_scanned += 1

        if path.suffix.lower() == ".json":
            text = path.read_text(encoding="utf-8", errors="replace")
            object_blobs = parse_stream_objects(text)
            lineage: list[dict[str, Any]] = []
            context_labels: list[str] = []
            prev_end = 0
            for idx, obj_blob in enumerate(object_blobs):
                labels, saw_string = extract_stream_labels(text[prev_end : obj_blob.start])
                if saw_string:
                    context_labels = labels

                record = parse_object_record(obj_blob.text)
                if record is None:
                    stats.parse_errors += 1
                    prev_end = obj_blob.end
                    continue

                stats.object_records += 1
                code = str(record.get("code", "")).strip()
                level = parse_level(code)
                if level is not None:
                    header = {"code": f">{level}", "name": str(record.get("name", "")).strip()}
                    cname = str(record.get("cname", "")).strip()
                    if cname:
                        header["cname"] = cname
                    if header["name"]:
                        lineage = lineage[: max(0, level - 1)] + [header]
                    prev_end = obj_blob.end
                    continue

                candidate = make_candidate(record, path.name, idx, lineage, context_labels)
                if candidate is None:
                    stats.skipped_records += 1
                    prev_end = obj_blob.end
                    continue
                candidates.append(candidate)
                stats.valid_candidates += 1
                prev_end = obj_blob.end

        elif path.suffix.lower() == ".py":
            patterns = parse_python_patterns(path)
            for idx, (pattern_key, record) in enumerate(sorted(patterns.items(), key=lambda item: item[0])):
                stats.python_records += 1
                local_record = dict(record)
                if not local_record.get("name"):
                    local_record["name"] = pattern_key
                candidate = make_candidate(local_record, path.name, idx, [], [])
                if candidate is None:
                    stats.skipped_records += 1
                    continue
                candidates.append(candidate)
                stats.valid_candidates += 1

    return candidates, stats


def load_catalogue(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"catalogue at {path} is not a JSON list")
    return data


def entry_is_taxonomy(entry: dict[str, Any]) -> bool:
    code = str(entry.get("code", ""))
    return bool(parse_level(code))


def build_existing_signatures(catalogue: list[dict[str, Any]], dim: int) -> set[str]:
    signatures: set[str] = set()
    for entry in catalogue:
        if not isinstance(entry, dict) or entry_is_taxonomy(entry):
            continue
        params = normalize_params(entry)
        cells_payload = entry.get("cells")
        cells = normalize_cells(cells_payload)
        if params is None or cells is None:
            continue
        cells_norm, inferred_dim = cells
        signatures.add(signature_for(dim if dim in {2, 3, 4} else inferred_dim, params, cells_norm))
    return signatures


def build_existing_identities(catalogue: list[dict[str, Any]]) -> tuple[set[str], set[str]]:
    codes: set[str] = set()
    names: set[str] = set()
    for entry in catalogue:
        if not isinstance(entry, dict) or entry_is_taxonomy(entry):
            continue
        code = clean_code(str(entry.get("code", "")).strip())
        name = str(entry.get("name", "")).strip().lower()
        if code:
            codes.add(code)
        if name:
            names.add(name)
    return codes, names


def fallback_taxonomy_headers(dim: int) -> list[dict[str, Any]]:
    prefix = "class" if dim == 2 else "subphylum"
    return [
        {"code": ">1", "name": f"{prefix}: Imported"},
        {"code": ">2", "name": "order: New Solitons"},
        {"code": ">3", "name": "family: Unsorted Imports"},
    ]


def header_key(header: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(header.get("code", "")).strip(),
        str(header.get("name", "")).strip(),
        str(header.get("cname", "")).strip(),
    )


def deduplicate_and_group(
    candidates: list[Candidate],
    existing_by_dim: dict[int, set[str]],
    existing_code_name_by_dim: dict[int, tuple[set[str], set[str]]],
) -> tuple[dict[int, list[Candidate]], dict[str, int]]:
    grouped: dict[int, list[Candidate]] = {2: [], 3: [], 4: []}
    counts = {
        "existing_duplicates": 0,
        "identity_duplicates": 0,
        "internal_duplicates": 0,
    }
    seen_new: set[str] = set()
    seen_codes_by_dim: dict[int, set[str]] = {2: set(), 3: set(), 4: set()}
    seen_names_by_dim: dict[int, set[str]] = {2: set(), 3: set(), 4: set()}
    for cand in candidates:
        if cand.signature in existing_by_dim[cand.dim]:
            counts["existing_duplicates"] += 1
            continue

        code = clean_code(str(cand.entry.get("code", "")).strip())
        name = str(cand.entry.get("name", "")).strip().lower()
        existing_codes, existing_names = existing_code_name_by_dim[cand.dim]
        if (code and (code in existing_codes or code in seen_codes_by_dim[cand.dim])) or (
            name and (name in existing_names or name in seen_names_by_dim[cand.dim])
        ):
            counts["identity_duplicates"] += 1
            continue

        if cand.signature in seen_new:
            counts["internal_duplicates"] += 1
            continue
        seen_new.add(cand.signature)
        if code:
            seen_codes_by_dim[cand.dim].add(code)
        if name:
            seen_names_by_dim[cand.dim].add(name)
        grouped[cand.dim].append(cand)
    return grouped, counts


def detect_newline(path: Path) -> str:
    raw = path.read_bytes()
    return "\r\n" if b"\r\n" in raw else "\n"


def write_catalogue(path: Path, data: list[dict[str, Any]], newline: str) -> None:
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    if not payload.endswith("\n"):
        payload += "\n"
    if newline != "\n":
        payload = payload.replace("\n", newline)
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(payload)


def apply_updates(
    catalogues: dict[int, list[dict[str, Any]]],
    grouped: dict[int, list[Candidate]],
) -> dict[int, int]:
    added_counts = {2: 0, 3: 0, 4: 0}

    for dim, additions in grouped.items():
        if not additions:
            continue

        catalogue = catalogues[dim]
        existing_headers = {
            header_key(entry)
            for entry in catalogue
            if isinstance(entry, dict) and entry_is_taxonomy(entry)
        }

        fallback_headers = fallback_taxonomy_headers(dim)
        fallback_emitted = False

        for candidate in additions:
            headers = candidate.taxonomy if candidate.taxonomy else fallback_headers
            if candidate.taxonomy:
                for header in headers:
                    key = header_key(header)
                    if key not in existing_headers and key[1]:
                        catalogue.append(header)
                        existing_headers.add(key)
            else:
                if not fallback_emitted:
                    for header in headers:
                        key = header_key(header)
                        if key not in existing_headers and key[1]:
                            catalogue.append(header)
                            existing_headers.add(key)
                    fallback_emitted = True

            catalogue.append(candidate.entry)
            added_counts[dim] += 1

    return added_counts


def main() -> int:
    args = parse_args()

    if not args.source_dir.exists():
        print(f"Source directory not found: {args.source_dir}", file=sys.stderr)
        return 1

    catalogues = {
        2: load_catalogue(args.catalogue_2d),
        3: load_catalogue(args.catalogue_3d),
        4: load_catalogue(args.catalogue_4d),
    }
    newlines = {
        2: detect_newline(args.catalogue_2d),
        3: detect_newline(args.catalogue_3d),
        4: detect_newline(args.catalogue_4d),
    }

    candidates, stats = collect_candidates(args.source_dir)

    existing_by_dim = {
        2: build_existing_signatures(catalogues[2], 2),
        3: build_existing_signatures(catalogues[3], 3),
        4: build_existing_signatures(catalogues[4], 4),
    }

    existing_code_name_by_dim = {
        2: build_existing_identities(catalogues[2]),
        3: build_existing_identities(catalogues[3]),
        4: build_existing_identities(catalogues[4]),
    }

    grouped, dedup_counts = deduplicate_and_group(candidates, existing_by_dim, existing_code_name_by_dim)

    print("Importer report")
    print("-" * 60)
    print(f"Files scanned: {stats.files_scanned}")
    print(f"JSON object records parsed: {stats.object_records}")
    print(f"Python pattern records parsed: {stats.python_records}")
    print(f"Valid candidates: {stats.valid_candidates}")
    print(f"Skipped records: {stats.skipped_records}")
    print(f"Parse errors: {stats.parse_errors}")
    print(f"Duplicates already in catalogues: {dedup_counts['existing_duplicates']}")
    print(f"Duplicates by existing code/name: {dedup_counts['identity_duplicates']}")
    print(f"Duplicates within import set: {dedup_counts['internal_duplicates']}")
    print(f"New 2D entries: {len(grouped[2])}")
    print(f"New 3D entries: {len(grouped[3])}")
    print(f"New 4D entries: {len(grouped[4])}")

    if not args.apply:
        print("Dry-run complete. Re-run with --apply to write catalogues.")
        return 0

    added_counts = apply_updates(catalogues, grouped)
    write_catalogue(args.catalogue_2d, catalogues[2], newlines[2])
    write_catalogue(args.catalogue_3d, catalogues[3], newlines[3])
    write_catalogue(args.catalogue_4d, catalogues[4], newlines[4])

    print("Applied updates")
    print("-" * 60)
    print(f"2D added: {added_counts[2]}")
    print(f"3D added: {added_counts[3]}")
    print(f"4D added: {added_counts[4]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
