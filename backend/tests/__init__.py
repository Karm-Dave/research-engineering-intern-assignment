import random


def make_test_posts(n=10):
    topics = ["mutual aid", "protest", "anarchism", "community", "resistance"]
    return [
        {
            "id": f"post_{i}",
            "title": f"Test post about {random.choice(topics)} {i}",
            "text": f"This is body text about {random.choice(topics)} and solidarity",
            "score": random.randint(1, 1000),
            "upvote_ratio": random.uniform(0.5, 1.0),
            "author": f"user_{i % 5}",
            "author_flair": None,
            "created_utc": 1739800000 + i * 3600,
            "created_date": "2025-02-17",
            "num_comments": random.randint(0, 100),
            "domain": random.choice(["crimethinc.com", "youtube.com", "reddit.com/r/Anarchism"]),
            "url": f"https://example.com/post/{i}",
            "subreddit": "Anarchism",
            "permalink": f"/r/Anarchism/comments/post_{i}",
            "is_self": random.choice([True, False]),
            "post_hint": None,
            "link_flair": None,
            "is_crosspost": False,
            "crosspost_subreddit": None,
        }
        for i in range(n)
    ]
