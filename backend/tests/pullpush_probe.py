import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone


try:
    # Use the same list as the app
    from config import SUBREDDITS
except Exception:
    SUBREDDITS = [
        "neoliberal",
        "politics",
        "worldpolitics",
        "socialism",
        "Liberal",
        "Conservative",
        "Anarchism",
        "democrats",
        "Republican",
        "PoliticalDiscussion",
    ]


BASE_URL = "https://api.pullpush.io/reddit/search/submission/"
SIZE = 1
SLEEP_SEC = 0.1

# Missing period from Mongo gap analysis (inclusive)
GAP_START = "2025-02-19"
GAP_END = "2026-02-17"


def to_ts(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def fetch(subreddit: str, after_ts: int, before_ts: int):
    url = (
        f"{BASE_URL}?subreddit={subreddit}"
        f"&after={after_ts}&before={before_ts}"
        f"&size={SIZE}&sort=asc"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "simppl-gap-check/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8", errors="ignore")
    data = json.loads(raw)
    return data.get("data") or [], data.get("error")


def iter_days(start_date: str, end_date: str):
    cur = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def main():
    print("Pullpush full-year probe for missing-gap feasibility")
    print("Subreddits:", ", ".join(SUBREDDITS))
    print(f"Gap: {GAP_START} -> {GAP_END} (daily windows)")

    per_sub_days = {s: 0 for s in SUBREDDITS}
    per_sub_first = {s: None for s in SUBREDDITS}
    per_sub_last = {s: None for s in SUBREDDITS}
    days_with_any = 0
    error_count = 0

    total_days = (datetime.strptime(GAP_END, "%Y-%m-%d") - datetime.strptime(GAP_START, "%Y-%m-%d")).days + 1
    total_requests = total_days * len(SUBREDDITS)
    req_done = 0

    for day_idx, day in enumerate(iter_days(GAP_START, GAP_END), start=1):
        next_day = day + timedelta(days=1)
        after_ts = int(day.timestamp())
        before_ts = int(next_day.timestamp())
        day_str = day.strftime("%Y-%m-%d")

        print(f"Day {day_idx}/{total_days} ({day_idx/total_days:.1%}) {day_str}")

        sub_with_posts = []
        for sub in SUBREDDITS:
            try:
                posts, err = fetch(sub, after_ts, before_ts)
                if err:
                    error_count += 1
                elif posts:
                    per_sub_days[sub] += 1
                    if per_sub_first[sub] is None:
                        per_sub_first[sub] = day_str
                    per_sub_last[sub] = day_str
                    sub_with_posts.append(sub)
                time.sleep(SLEEP_SEC)
            except urllib.error.HTTPError:
                error_count += 1
            except Exception:
                error_count += 1

            req_done += 1
            if req_done % 100 == 0:
                print(f"  Requests: {req_done}/{total_requests} ({req_done/total_requests:.1%})")

        if sub_with_posts:
            days_with_any += 1
            print(f"  {day_str}: {len(sub_with_posts)}/{len(SUBREDDITS)} subreddits have posts")

    print("\nSummary")
    print(f"Days with any posts: {days_with_any}")
    print(f"Total errors: {error_count}")
    for sub in SUBREDDITS:
        print(
            f"{sub:<20} days_with_posts={per_sub_days[sub]} "
            f"first={per_sub_first[sub]} last={per_sub_last[sub]}"
        )


if __name__ == "__main__":
    main()
