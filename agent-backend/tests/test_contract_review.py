import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from clarification_prompts import build_contract_review_prompts  # noqa: E402


def _contract():
    return {
        "drivingQuestion": "为什么上帝已死是尺度崩塌？",
        "centralTension": "失去信仰不只少一个指南",
        "problemFraming": {
            "phenomenon": "现代人没信仰也活得好好的",
            "contrast": "直觉当少个指南；尼采说是尺度整体失效",
            "modelGap": "缺少价值尺度这个对象模型",
        },
        "scope": {"include": ["上帝已死", "虚无主义"], "exclude": ["海德格尔阐释"]},
    }


class ContractReviewPromptTests(unittest.TestCase):
    def test_prompt_carries_contract_fields_and_output_schema(self):
        system, user = build_contract_review_prompts(_contract())
        self.assertIn("phenomenon", system + user)  # 评审需针对 problemFraming 字段
        self.assertIn("现代人没信仰也活得好好的", user)  # 具体现象进入 prompt
        self.assertIn("缺少价值尺度这个对象模型", user)   # modelGap 进入 prompt
        self.assertIn("teachingHooks", user)             # 要求产出教学抓手
        self.assertIn("pass", user)                      # 要求输出裁决

    def test_prompt_asks_for_specificity_not_wordcount(self):
        _, user = build_contract_review_prompts(_contract())
        # 评审标准必须包含"是否具体现象/是否同义反复/是否可教"这类语义检查
        self.assertTrue(any(k in user for k in ("同义反复", "泛化", "可教", "伪问题")))


from clarification_prompts import build_review_followup_prompts  # noqa: E402


class ReviewFollowupPromptTests(unittest.TestCase):
    def test_prompt_carries_issues_and_forbids_fieldnames(self):
        system, user = build_review_followup_prompts(
            ["modelGap 只是重复了问题，没有指出缺失的具体关系"],
            [{"role": "bot", "text": "上一问"}, {"role": "user", "text": "上一答"}],
        )
        self.assertIn("只是重复了问题", user)          # 评审发现进入 prompt
        self.assertIn("上一答", user)                  # 近期对话进入 prompt
        combined = system + user
        self.assertIn("不要出现", combined)            # 明令禁止内部字段名出现在追问里
        self.assertIn("options", user)                 # 要求给可点选项


if __name__ == "__main__":
    unittest.main()
