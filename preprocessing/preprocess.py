import argparse
import json
import re
from collections import Counter
from html import unescape
from pathlib import Path
from urllib.parse import urlparse


TAG_RE = re.compile(r"<[^>]+>")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def clean_text(value: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    text = unescape(value)
    text = TAG_RE.sub(" ", text)
    text = CONTROL_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_domain(data: dict) -> str:
    domain = data.get("domain") or ""
    if domain:
        return domain
    subreddit = data.get("subreddit") or ""
    is_self = bool(data.get("is_self"))
    url = data.get("url_overridden_by_dest") or data.get("url") or ""
    if is_self and subreddit:
        return f"self.{subreddit}"
    if url:
        parsed = urlparse(url)
        if parsed.netloc:
            return parsed.netloc.lower()
        if "://" not in url:
            parsed = urlparse(f"https://{url}")
            if parsed.netloc:
                return parsed.netloc.lower()
        if url.startswith("/"):
            return "reddit.com"
    return domain


def normalize_url(data: dict) -> str:
    url = data.get("url_overridden_by_dest") or data.get("url") or ""
    if not url:
        permalink = data.get("permalink") or ""
        if permalink:
            url = f"https://www.reddit.com{permalink}"
    return url


def normalize_created_utc(data: dict):
    created = data.get("created_utc", data.get("created"))
    if created is None:
        return None
    try:
        return float(created)
    except Exception:
        return None


def preprocess(input_path: Path, output_path: Path) -> dict:
    stats = Counter()
    missing_fields = Counter()

    with input_path.open("r", encoding="utf-8") as src, output_path.open(
        "w", encoding="utf-8"
    ) as dst:
        for line_num, raw in enumerate(src, 1):
            raw = raw.strip()
            if not raw:
                stats["blank_lines"] += 1
                continue
            try:
                obj = json.loads(raw)
            except Exception:
                stats["bad_lines"] += 1
                continue
            if not isinstance(obj, dict):
                stats["non_dict"] += 1
                continue
            data = obj.get("data")
            if not isinstance(data, dict):
                stats["missing_data"] += 1
                continue

            # Clean core text fields
            data["title"] = clean_text(data.get("title") or "")
            data["selftext"] = clean_text(data.get("selftext") or "")

            # Normalize URL + domain
            normalized_url = normalize_url(data)
            if normalized_url:
                data["url_overridden_by_dest"] = normalized_url
                data["url"] = data.get("url") or normalized_url
            data["domain"] = normalize_domain(data)

            # Normalize created_utc
            created_utc = normalize_created_utc(data)
            if created_utc is not None:
                data["created_utc"] = created_utc

            # Track missing essentials
            for field in ("id", "subreddit", "title", "created_utc"):
                if not data.get(field):
                    missing_fields[field] += 1

            obj["kind"] = obj.get("kind") or "t3"
            obj["data"] = data

            dst.write(json.dumps(obj, ensure_ascii=False) + "\n")
            stats["written"] += 1

    return {
        "stats": dict(stats),
        "missing_fields": dict(missing_fields),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean and normalize JSONL dataset.")
    parser.add_argument(
        "--input",
        default="data/data.jsonl",
        help="Path to input JSONL file",
    )
    parser.add_argument(
        "--output",
        default="data/cleaned_data.jsonl",
        help="Path to output JSONL file",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    report = preprocess(input_path, output_path)
    print("Preprocess complete.")
    print("Output:", output_path)
    print("Stats:", report["stats"])
    print("Missing fields:", report["missing_fields"])


if __name__ == "__main__":
    main()
