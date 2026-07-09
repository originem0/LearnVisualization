import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from research import extract_main_text, normalize_for_match, quote_in_text, unwrap_ddg_href  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
