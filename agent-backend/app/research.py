from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable
from urllib import parse, request

try:
    from .common import ensure_dir, write_json_atomic, write_text_atomic
except ImportError:
    from common import ensure_dir, write_json_atomic, write_text_atomic

USER_AGENT = "LearnVisualization-Research/1.0 (+https://visualize.sharonzhou.site)"
MAX_PAGE_CHARS = 30_000
MAX_WEB_PAGES = 12
MIN_EVIDENCE = 12
MAX_EVIDENCE = 25
FETCH_TIMEOUT = 20


def http_get(url: str, *, timeout: int = FETCH_TIMEOUT) -> str:
    req = request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "zh,en;q=0.8"})
    with request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read(2_000_000)
        charset = resp.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, errors="replace")


class _TextExtractor(HTMLParser):
    _SKIP = {"script", "style", "nav", "header", "footer", "aside", "noscript", "form", "svg"}
    _BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "blockquote", "pre", "td"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._chunks: list[str] = []
        self._current: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BLOCK:
            self._flush()

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag in self._BLOCK:
            self._flush()

    def handle_data(self, data):
        if not self._skip_depth and data.strip():
            self._current.append(data)

    def _flush(self):
        text = "".join(self._current).strip()
        if text:
            self._chunks.append(text)
        self._current = []

    def text(self) -> str:
        self._flush()
        return "\n".join(self._chunks)


def extract_main_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.text()


_WS_RE = re.compile(r"\s+")
_PUNCT_MAP = str.maketrans({
    "“": '"', "”": '"', "‘": "'", "’": "'",
    "—": "-", "–": "-",
    "​": "", " ": " ",
})


def normalize_for_match(text: str) -> str:
    """Whitespace-free, punctuation-unified, lowercased form used ONLY for substring checks."""
    text = str(text).replace("…", "...")
    text = _WS_RE.sub("", text.translate(_PUNCT_MAP))
    return text.lower()


def quote_in_text(quote: str, text: str) -> bool:
    q = normalize_for_match(quote)
    return len(q) >= 12 and q in normalize_for_match(text)


def wiki_search_titles(topic: str, lang: str, limit: int = 2) -> list[str]:
    url = (
        f"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&format=json"
        f"&srlimit={limit}&srsearch={parse.quote(topic)}"
    )
    data = json.loads(http_get(url))
    return [item["title"] for item in data.get("query", {}).get("search", []) if item.get("title")]


def wiki_page_text(title: str, lang: str) -> str:
    url = (
        f"https://{lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1"
        f"&redirects=1&format=json&titles={parse.quote(title)}"
    )
    data = json.loads(http_get(url))
    for page in (data.get("query", {}).get("pages", {}) or {}).values():
        extract = page.get("extract")
        if extract:
            return str(extract)
    return ""


def unwrap_ddg_href(href: str) -> str:
    if href.startswith("//"):
        href = "https:" + href
    parsed = parse.urlparse(href)
    if parsed.path.startswith("/l/"):
        target = (parse.parse_qs(parsed.query).get("uddg") or [""])[0]
        return target
    return href


class _DdgResultParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[dict[str, str]] = []
        self._in_link = False
        self._href = ""
        self._title: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attr = dict(attrs)
            if "result__a" in (attr.get("class") or "") and attr.get("href"):
                self._in_link = True
                self._href = attr["href"]
                self._title = []

    def handle_data(self, data):
        if self._in_link:
            self._title.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._in_link:
            self._in_link = False
            url = unwrap_ddg_href(self._href)
            title = "".join(self._title).strip()
            if url.startswith("http") and title:
                self.results.append({"title": title, "url": url})


def ddg_search(query: str, max_results: int = 5) -> list[dict[str, str]]:
    html = http_get(f"https://html.duckduckgo.com/html/?q={parse.quote(query)}")
    parser = _DdgResultParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.results[:max_results]
