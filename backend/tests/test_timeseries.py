from timeseries import TimeSeriesAnalyzer
from tests import make_test_posts


def _make_posts():
    posts = make_test_posts(12)
    # Ensure topic keyword exists
    posts[0]["title"] = "Mutual aid efforts in the community"
    posts[0]["text"] = "Mutual aid networks are growing"
    # Ensure multiple domains
    for i in range(6):
        posts[i]["domain"] = "alpha.com"
    for i in range(6, 12):
        posts[i]["domain"] = "beta.com"
    return posts


def test_posts_per_day_sorted():
    posts = _make_posts()
    ts = TimeSeriesAnalyzer(posts)
    data = ts.get_posts_per_day()
    dates = [d["date"] for d in data]
    assert dates == sorted(dates)


def test_posts_per_week_has_scores():
    posts = _make_posts()
    ts = TimeSeriesAnalyzer(posts)
    data = ts.get_posts_per_week()
    assert len(data) > 0
    for entry in data:
        assert entry["avg_score"] > 0


def test_topic_trend_with_keyword():
    posts = _make_posts()
    ts = TimeSeriesAnalyzer(posts)
    data = ts.get_topic_trend("mutual aid")
    assert len(data) > 0


def test_topic_trend_no_results():
    posts = _make_posts()
    ts = TimeSeriesAnalyzer(posts)
    data = ts.get_topic_trend("xyzabc123")
    assert data == []


def test_domain_trend_top_n():
    posts = _make_posts()
    ts = TimeSeriesAnalyzer(posts)
    trends = ts.get_domain_trend(top_n=2)
    assert len(trends.keys()) == 2
