import unittest

from draft_translations import collect_missing_texts, create_drafts


class CollectMissingTextsTests(unittest.TestCase):
    def test_collects_only_missing_languages_with_json_pointer_paths(self):
        document = [
            {
                "stem": {"en": "Solve for x", "te": "x విలువ కనుగొనండి"},
                "options": [{"text": {"en": "x equals 2", "hi": "x दो के बराबर है"}}],
            }
        ]

        targets = collect_missing_texts(document)

        self.assertEqual(
            targets,
            [
                {
                    "path": "/0/stem",
                    "language": "hi",
                    "sourceText": "Solve for x",
                },
                {
                    "path": "/0/options/0/text",
                    "language": "te",
                    "sourceText": "x equals 2",
                },
            ],
        )

    def test_escapes_json_pointer_segments(self):
        targets = collect_missing_texts({"a/b~c": {"en": "Text"}})

        self.assertEqual(targets[0]["path"], "/a~1b~0c")

    def test_uses_empty_pointer_for_a_root_localized_text(self):
        targets = collect_missing_texts({"en": "Text"})

        self.assertEqual(targets[0]["path"], "")


class CreateDraftsTests(unittest.TestCase):
    def test_marks_each_suggestion_as_machine_draft(self):
        targets = [
            {"path": "/title", "language": "te", "sourceText": "Equation"},
            {"path": "/title", "language": "hi", "sourceText": "Equation"},
        ]

        drafts = create_drafts(
            targets,
            lambda texts, language: [f"{language}:{text}" for text in texts],
        )

        self.assertEqual(
            drafts,
            [
                {
                    "path": "/title",
                    "language": "te",
                    "sourceText": "Equation",
                    "draftText": "te:Equation",
                    "reviewStatus": "machine_draft",
                },
                {
                    "path": "/title",
                    "language": "hi",
                    "sourceText": "Equation",
                    "draftText": "hi:Equation",
                    "reviewStatus": "machine_draft",
                },
            ],
        )

    def test_rejects_mismatched_translation_count(self):
        with self.assertRaisesRegex(ValueError, "1 results for 2"):
            create_drafts(
                [
                    {"path": "/title", "language": "te", "sourceText": "One"},
                    {"path": "/body", "language": "te", "sourceText": "Two"},
                ],
                lambda _texts, _language: ["ఒకటి"],
            )

    def test_rejects_empty_translation(self):
        with self.assertRaisesRegex(ValueError, "empty te draft"):
            create_drafts(
                [{"path": "/title", "language": "te", "sourceText": "Equation"}],
                lambda _texts, _language: [""],
            )


if __name__ == "__main__":
    unittest.main()
