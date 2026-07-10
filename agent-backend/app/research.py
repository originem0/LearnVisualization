from __future__ import annotations

import json
import os
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


def _research_opener() -> request.OpenerDirector:
    """外部源站抓取可能需要走本地代理（服务器直连维基/搜索引擎不可达），
    但 LLM 中转调用保持直连——所以这里用显式 opener 而不是进程级代理环境变量。"""
    proxy = os.environ.get("AGENT_RESEARCH_PROXY", "").strip()
    if proxy:
        return request.build_opener(request.ProxyHandler({"http": proxy, "https": proxy}))
    return request.build_opener()


def http_get(url: str, *, timeout: int = FETCH_TIMEOUT) -> str:
    req = request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "zh,en;q=0.8"})
    with _research_opener().open(req, timeout=timeout) as resp:
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


def run_research(
    *,
    topic: str,
    contract: dict[str, Any],
    client: Any,
    research_model: str | None,
    sources_dir: Path,
    check_cancelled: Callable[[], None] = lambda: None,
    log: Callable[[str], None] = lambda msg: print(msg, file=sys.stderr),
) -> dict[str, Any]:
    try:
        from .essay_prompts import build_evidence_extraction_prompts, build_research_query_prompts
    except ImportError:
        from essay_prompts import build_evidence_extraction_prompts, build_research_query_prompts

    ensure_dir(sources_dir)

    # 1. LLM 出题
    sys_p, usr_p = build_research_query_prompts(topic, contract)
    response = client.generate_json(
        schema_name="research_queries", system_prompt=sys_p, user_prompt=usr_p,
        max_tokens=800, model=research_model,
    )
    queries = [str(q).strip() for q in (response.get("content") or {}).get("queries") or [] if str(q).strip()][:10]
    if not queries:
        queries = [topic]
    # scope 里的其他思想家/概念要靠这些条目名进语料，只搜主主题会漏掉对照对象
    wiki_topics = [str(t).strip() for t in (response.get("content") or {}).get("wikiTopics") or [] if str(t).strip()][:6]

    # 2. 抓取语料：wiki 优先，DDG 补充
    documents: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    def add_document(title: str, url: str, text: str) -> None:
        text = (text or "").strip()
        if len(text) < 500 or url in seen_urls:
            return
        seen_urls.add(url)
        documents.append({
            "docId": f"D{len(documents) + 1:02d}",
            "title": title,
            "url": url,
            "text": text[:MAX_PAGE_CHARS],
        })

    def fetch_wiki(search_term: str, lang: str, limit: int) -> None:
        try:
            titles = wiki_search_titles(search_term, lang, limit=limit)
        except Exception as exc:
            log(f"[research] wiki({lang}) search '{search_term}' failed: {exc}")
            return
        for title in titles:
            try:
                add_document(
                    f"Wikipedia({lang}): {title}",
                    f"https://{lang}.wikipedia.org/wiki/{parse.quote(title)}",
                    wiki_page_text(title, lang),
                )
            except Exception as exc:
                log(f"[research] wiki({lang}) page '{title}' failed: {exc}")

    for lang in ("zh", "en"):
        check_cancelled()
        fetch_wiki(topic, lang, 3)
        for wiki_topic in wiki_topics:
            check_cancelled()
            fetch_wiki(wiki_topic, lang, 1)

    web_candidates: list[dict[str, str]] = []
    for query in queries:
        check_cancelled()
        try:
            web_candidates.extend(ddg_search(query))
        except Exception as exc:
            log(f"[research] ddg '{query}' failed: {exc}")

    fetched = 0
    for item in web_candidates:
        if fetched >= MAX_WEB_PAGES:
            break
        if item["url"] in seen_urls:
            continue
        check_cancelled()
        try:
            text = extract_main_text(http_get(item["url"]))
        except Exception as exc:
            log(f"[research] fetch {item['url']} failed: {exc}")
            continue
        before = len(documents)
        add_document(item["title"], item["url"], text)
        if len(documents) > before:
            fetched += 1

    if not documents:
        raise ValueError("研究阶段没有抓到任何可用材料，请检查网络或换一个更具体的主题")

    # 落盘供审计与后续保真校验
    for doc in documents:
        write_text_atomic(sources_dir / f"{doc['docId']}.txt", doc["text"])
    write_json_atomic(
        sources_dir / "index.json",
        [{"docId": d["docId"], "title": d["title"], "url": d["url"], "chars": len(d["text"])} for d in documents],
    )

    # 3. 逐文档萃取证据；quote 必须通过原文子串校验
    evidence: list[dict[str, Any]] = []
    dropped_quotes = 0
    seen_content: set[str] = set()
    for doc in documents:
        check_cancelled()
        if len(evidence) >= MAX_EVIDENCE:
            break
        sys_p, usr_p = build_evidence_extraction_prompts(
            topic=topic, contract=contract,
            doc_title=doc["title"], doc_url=doc["url"], doc_text=doc["text"],
        )
        try:
            response = client.generate_json(
                schema_name=f"evidence_{doc['docId']}", system_prompt=sys_p, user_prompt=usr_p,
                max_tokens=2500, model=research_model,
            )
        except Exception as exc:
            log(f"[research] extraction failed for {doc['docId']}: {exc}")
            continue
        for raw in (response.get("content") or {}).get("evidence") or []:
            if not isinstance(raw, dict) or len(evidence) >= MAX_EVIDENCE:
                continue
            kind = str(raw.get("kind") or "").strip()
            content = str(raw.get("content") or "").strip()
            if kind not in {"quote", "fact", "example", "figure"} or len(content) < 15:
                continue
            if kind == "quote" and not quote_in_text(content, doc["text"]):
                dropped_quotes += 1
                continue
            key = normalize_for_match(content)[:80]
            if key in seen_content:
                continue
            seen_content.add(key)
            evidence.append({
                "id": f"E{len(evidence) + 1:02d}",
                "kind": kind,
                "content": content,
                "note": str(raw.get("note") or "").strip(),
                "sourceTitle": doc["title"],
                "sourceUrl": doc["url"],
                "docId": doc["docId"],
            })

    if len(evidence) < MIN_EVIDENCE:
        raise ValueError(
            f"研究材料不足：只萃取到 {len(evidence)} 条可用证据"
            f"（其中 {dropped_quotes} 条引文未通过原文校验被丢弃）。建议换一个更具体或材料更丰富的主题。"
        )

    return {
        "topic": topic,
        "queries": queries,
        "documents": [{"docId": d["docId"], "title": d["title"], "url": d["url"], "chars": len(d["text"])} for d in documents],
        "evidence": evidence,
        "stats": {"documentCount": len(documents), "evidenceCount": len(evidence), "droppedQuotes": dropped_quotes},
    }
