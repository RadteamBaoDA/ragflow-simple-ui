#!/usr/bin/env python3
"""
Convert an Easy Dataset export (QA / evaluation dataset) into an evaluation CSV.

Output columns:  test,question,expected_answer,source_doc,category

Easy Dataset (https://github.com/ConardLi/easy-dataset) exports datasets as
JSON or JSONL in Alpaca / ShareGPT / raw styles. This script normalizes any of
those shapes into the evaluation CSV above. It pulls the domain label into
`category` and the chunk/file name into `source_doc` when they are present in
the export, and uses sensible fallbacks when they are not.

Usage:
    python easy_dataset_to_eval_csv.py input.json -o eval.csv \
        --source-doc mydoc.pdf --category-default general --id-prefix test_ --pad 4
"""
import argparse
import csv
import json
import os
import sys


def load_records(path):
    """Load a JSON array, a wrapped object, or a JSONL file into a list of dicts."""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read().strip()
    if not text:
        return []
    # Try a single JSON document first (array or object).
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            # Some exports wrap the rows under a key.
            for key in ("data", "dataset", "datasets", "items", "rows"):
                if isinstance(data.get(key), list):
                    return data[key]
            return [data]
    except json.JSONDecodeError:
        pass
    # Fall back to JSONL (one object per line).
    records = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            records.append(json.loads(line))
    return records


def first_present(record, keys):
    for k in keys:
        v = record.get(k)
        if v not in (None, ""):
            return v
    return None


def extract_question(record):
    # ShareGPT style: conversations / messages list.
    convs = record.get("conversations") or record.get("messages")
    if isinstance(convs, list):
        for turn in convs:
            if not isinstance(turn, dict):
                continue
            role = (turn.get("from") or turn.get("role") or "").lower()
            if role in ("human", "user"):
                return (turn.get("value") or turn.get("content") or "").strip()
    # Alpaca / raw styles.
    q = first_present(record, ("question", "instruction", "query", "prompt"))
    if q is None:
        q = record.get("input")
        return (str(q).strip() if q else "")
    # Alpaca may split context into a separate `input` field.
    extra = record.get("input") if "instruction" in record else None
    if extra and extra != q:
        return f"{q}\n{extra}".strip()
    return str(q).strip()


def extract_answer(record):
    convs = record.get("conversations") or record.get("messages")
    if isinstance(convs, list):
        for turn in convs:
            if not isinstance(turn, dict):
                continue
            role = (turn.get("from") or turn.get("role") or "").lower()
            if role in ("gpt", "assistant"):
                return (turn.get("value") or turn.get("content") or "").strip()
    a = first_present(
        record, ("expected_answer", "answer", "output", "response", "completion")
    )
    return (str(a).strip() if a else "")


def extract_category(record, default):
    cat = first_present(
        record, ("category", "label", "questionLabel", "tag", "domain", "labelName")
    )
    if isinstance(cat, list):
        cat = ", ".join(str(c) for c in cat if c)
    return str(cat).strip() if cat else default


def extract_source(record, default):
    src = first_present(
        record,
        ("source_doc", "source", "chunkName", "fileName", "file",
         "document", "docName", "chunkId"),
    )
    return str(src).strip() if src else default


def main():
    p = argparse.ArgumentParser(
        description="Convert an Easy Dataset export to an evaluation CSV."
    )
    p.add_argument("input", help="Easy Dataset export file (.json or .jsonl)")
    p.add_argument("-o", "--output", default="eval_dataset.csv",
                   help="Output CSV path (default: eval_dataset.csv)")
    p.add_argument("--source-doc", default=None,
                   help="Fallback source_doc when the export lacks one "
                        "(e.g. the PDF filename). Defaults to the input filename.")
    p.add_argument("--category-default", default="general",
                   help="Fallback category when no label is present.")
    p.add_argument("--id-prefix", default="",
                   help="Optional prefix for the test id, e.g. 'test_' -> test_0001.")
    p.add_argument("--start-index", type=int, default=1, help="First test id number.")
    p.add_argument("--pad", type=int, default=0,
                   help="Zero-pad width for numeric ids (4 -> 0001). 0 = no padding.")
    args = p.parse_args()

    records = load_records(args.input)
    if not records:
        sys.exit("No records found in the input file.")

    default_source = args.source_doc or os.path.basename(args.input)

    rows, n = [], args.start_index
    for rec in records:
        if not isinstance(rec, dict):
            continue
        question = extract_question(rec)
        if not question:
            continue  # skip empty rows
        num = str(n).zfill(args.pad) if args.pad else str(n)
        rows.append({
            "test": f"{args.id_prefix}{num}",
            "question": question,
            "expected_answer": extract_answer(rec),
            "source_doc": extract_source(rec, default_source),
            "category": extract_category(rec, args.category_default),
        })
        n += 1

    with open(args.output, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["test", "question", "expected_answer", "source_doc", "category"]
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
