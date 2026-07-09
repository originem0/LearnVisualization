import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from research import extract_main_text, normalize_for_match, quote_in_text, unwrap_ddg_href  # noqa: E402
from research import run_research  # noqa: E402


class TextExtractionTests(unittest.TestCase):
    def test_extract_main_text_keeps_paragraphs_drops_chrome(self):
        html = (
            "<html><head><style>.x{}</style><script>var a=1;</script></head><body>"
            "<nav>首页 导航</nav>"
            "<p>尼采在《快乐的科学》第 125 节借疯子之口宣告上帝已死。</p>"
            "<aside>侧边栏广告</aside>"
            "<h2>价值重估</h2><p>重估一切价值是晚期计划。</p>"
            "<footer>版权信息</footer></body></html>"
        )
        text = extract_main_text(html)
        self.assertIn("第 125 节", text)
        self.assertIn("价值重估", text)
        self.assertNotIn("导航", text)
        self.assertNotIn("广告", text)
        self.assertNotIn("var a=1", text)

    def test_quote_in_text_tolerates_whitespace_and_curly_quotes(self):
        source = '他说："上帝死了！上帝\n真的死了！是我们杀死了他。"这一段广为流传。'
        quote = '上帝死了！上帝真的死了！是我们杀死了他。'
        self.assertTrue(quote_in_text(quote, source))

    def test_quote_in_text_rejects_paraphrase_and_short(self):
        source = "尼采认为旧的价值坐标已经失效。"
        self.assertFalse(quote_in_text("尼采认为价值坐标失效了", source))  # 改写
        self.assertFalse(quote_in_text("尼采", source))  # 太短

    def test_normalize_strips_ws_and_unifies_punct(self):
        self.assertEqual(normalize_for_match('"A B"—C'), '"ab"-c')


class DdgTests(unittest.TestCase):
    def test_unwrap_ddg_redirect(self):
        href = "//duckduckgo.com/l/?uddg=https%3A%2F%2Fplato.stanford.edu%2Fentries%2Fnietzsche%2F&rut=abc"
        self.assertEqual(unwrap_ddg_href(href), "https://plato.stanford.edu/entries/nietzsche/")

    def test_unwrap_plain_href_passthrough(self):
        self.assertEqual(unwrap_ddg_href("https://example.com/a"), "https://example.com/a")


FAKE_DOC = (
    "尼采研究材料正文。" * 80
    + '他说："上帝死了！上帝真的死了！是我们杀死了他。"这一段出自《快乐的科学》第 125 节。'
)


class _FakeResearchClient:
    def __init__(self, evidence_per_doc=None):
        self.evidence_per_doc = evidence_per_doc
        self.calls = []

    def generate_json(self, *, schema_name, system_prompt, user_prompt, temperature=0.2, max_tokens=8000, model=None):
        self.calls.append((schema_name, model))
        if schema_name == "research_queries":
            content = {"queries": ["尼采 上帝已死 快乐的科学", "Nietzsche genealogy Schuld"]}
        elif schema_name.startswith("evidence_"):
            doc_id = schema_name.split("_", 1)[1]
            if self.evidence_per_doc is not None:
                content = {"evidence": self.evidence_per_doc}
            else:
                content = {"evidence": (
                    [{"kind": "quote", "content": "上帝死了！上帝真的死了！是我们杀死了他。", "note": "尺度崩塌宣告"}]
                    + [{"kind": "fact", "content": f"{doc_id} 具体事实{i}：某个可核查的历史/文本细节陈述", "note": "锚点"} for i in range(6)]
                )}
        else:
            raise AssertionError(f"unexpected schema: {schema_name}")
        return {"content": content, "usage": {}, "model": model or "fake"}


def _contract():
    return {"drivingQuestion": "为什么上帝已死意味着尺度崩塌？", "scope": {"include": ["虚无主义"], "exclude": []}}


class RunResearchTests(unittest.TestCase):
    def _patched(self, client):
        return (
            patch("research.wiki_search_titles", side_effect=lambda topic, lang, limit=2: [f"{topic}-{lang}"]),
            patch("research.wiki_page_text", side_effect=lambda title, lang: FAKE_DOC),
            patch("research.ddg_search", return_value=[]),
        )

    def test_happy_path_builds_verified_library(self):
        client = _FakeResearchClient()
        p1, p2, p3 = self._patched(client)
        with tempfile.TemporaryDirectory() as tmp, p1, p2, p3:
            artifact = run_research(
                topic="尼采哲学", contract=_contract(), client=client,
                research_model="researcher-x", sources_dir=Path(tmp) / "src",
            )
            self.assertGreaterEqual(len(artifact["evidence"]), 12)
            self.assertEqual(artifact["evidence"][0]["id"], "E01")
            quote_items = [e for e in artifact["evidence"] if e["kind"] == "quote"]
            self.assertTrue(quote_items and quote_items[0]["sourceUrl"].startswith("https://"))
            self.assertTrue((Path(tmp) / "src" / "index.json").exists())
            self.assertTrue((Path(tmp) / "src" / "D01.txt").exists())
            # research 调用带 research_model
            self.assertTrue(all(m == "researcher-x" for (_, m) in client.calls))

    def test_fabricated_quote_is_dropped(self):
        client = _FakeResearchClient(evidence_per_doc=(
            [{"kind": "quote", "content": "这句引文并不在原文里，是模型编造的完整句子。", "note": ""}]
            + [{"kind": "fact", "content": f"独立事实{i}：某个可核查的历史/文本细节陈述充分长", "note": ""} for i in range(12)]
        ))
        p1, p2, p3 = self._patched(client)
        with tempfile.TemporaryDirectory() as tmp, p1, p2, p3:
            artifact = run_research(
                topic="尼采哲学", contract=_contract(), client=client,
                research_model=None, sources_dir=Path(tmp) / "src",
            )
            self.assertFalse([e for e in artifact["evidence"] if e["kind"] == "quote"])
            self.assertGreaterEqual(artifact["stats"]["droppedQuotes"], 1)

    def test_insufficient_evidence_fails_in_chinese(self):
        client = _FakeResearchClient(evidence_per_doc=[
            {"kind": "fact", "content": "唯一一条事实：不足以支撑课程写作的证据量", "note": ""},
        ])
        p1, p2, p3 = self._patched(client)
        with tempfile.TemporaryDirectory() as tmp, p1, p2, p3:
            with self.assertRaises(ValueError) as ctx:
                run_research(topic="尼采哲学", contract=_contract(), client=client,
                             research_model=None, sources_dir=Path(tmp) / "src")
            self.assertIn("研究材料不足", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
