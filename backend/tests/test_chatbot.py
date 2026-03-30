from unittest.mock import MagicMock, patch

from chatbot import DataChatbot
from tests import make_test_posts


def _make_results():
    posts = make_test_posts(3)
    return [{"post": posts[0], "score": 0.9, "rank": 1}]


class DummySearch:
    def __init__(self, results, related_queries=None):
        self._results = results
        self._related = related_queries or ["q1", "q2", "q3"]

    def search(self, query, top_k=5):
        return self._results

    def get_related_queries(self, query, results):
        return self._related


def _mock_groq_response(content="answer"):
    mock_response = MagicMock()
    mock_message = MagicMock()
    mock_message.content = content
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response.choices = [mock_choice]
    return mock_response


def test_chat_returns_expected_keys():
    results = _make_results()
    search = DummySearch(results)
    bot = DataChatbot([], search)

    with patch("chatbot.Groq") as mock_groq:
        client = MagicMock()
        client.chat.completions.create.return_value = _mock_groq_response()
        mock_groq.return_value = client
        out = bot.chat("what is discussed?")

    assert "response" in out
    assert "sources" in out
    assert "related_queries" in out


def test_chat_does_not_crash_empty_history():
    results = _make_results()
    search = DummySearch(results)
    bot = DataChatbot([], search)

    with patch("chatbot.Groq") as mock_groq:
        client = MagicMock()
        client.chat.completions.create.return_value = _mock_groq_response()
        mock_groq.return_value = client
        out = bot.chat("hello", conversation_history=None)

    assert isinstance(out, dict)


def test_chat_does_not_crash_long_query():
    results = _make_results()
    search = DummySearch(results)
    bot = DataChatbot([], search)

    with patch("chatbot.Groq") as mock_groq:
        client = MagicMock()
        client.chat.completions.create.return_value = _mock_groq_response()
        mock_groq.return_value = client
        out = bot.chat("x" * 500)

    assert "response" in out


def test_groq_error_handled():
    results = _make_results()
    search = DummySearch(results)
    bot = DataChatbot([], search)

    with patch("chatbot.Groq", side_effect=Exception("boom")):
        out = bot.chat("what is discussed?")

    assert "response" in out
    assert out["response"].startswith("[Response unavailable")


def test_related_queries_count():
    results = _make_results()
    search = DummySearch(results, related_queries=["a", "b", "c"])
    bot = DataChatbot([], search)

    with patch("chatbot.Groq") as mock_groq:
        client = MagicMock()
        client.chat.completions.create.return_value = _mock_groq_response()
        mock_groq.return_value = client
        out = bot.chat("what is discussed?")

    assert len(out["related_queries"]) == 3
