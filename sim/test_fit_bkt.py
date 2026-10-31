import tempfile
import unittest
from pathlib import Path

import pandas as pd

from fit_bkt import fit, load_responses, parameter_rows


class LoadResponsesTests(unittest.TestCase):
    def test_sorts_each_student_skill_sequence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "responses.csv"
            pd.DataFrame(
                [
                    {"user_id": "s1", "skill_name": "M6.A", "correct": 0, "order_id": 1},
                    {"user_id": "s1", "skill_name": "M6.A", "correct": 1, "order_id": 0},
                ]
            ).to_csv(path, index=False)
            result = load_responses(path)
        self.assertEqual(result["correct"].tolist(), [1, 0])

    def test_rejects_duplicate_order_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "responses.csv"
            pd.DataFrame(
                [
                    {"user_id": "s1", "skill_name": "M6.A", "correct": 0, "order_id": 0},
                    {"user_id": "s1", "skill_name": "M6.A", "correct": 1, "order_id": 0},
                ]
            ).to_csv(path, index=False)
            with self.assertRaisesRegex(ValueError, "unique order_id"):
                load_responses(path)


class ParameterMappingTests(unittest.TestCase):
    def test_maps_pybkt_parameter_names_to_engine_contract(self):
        params = pd.DataFrame(
            [
                ("M6.A", "prior", "default", 0.3),
                ("M6.A", "learns", "default", 0.2),
                ("M6.A", "guesses", "default", 0.25),
                ("M6.A", "slips", "default", 0.1),
            ],
            columns=["skill", "param", "class", "value"],
        )
        params = params.set_index(["skill", "param", "class"])
        self.assertEqual(
            parameter_rows(params),
            [{"conceptId": "M6.A", "pL0": 0.3, "pT": 0.2, "pG": 0.25, "pS": 0.1}],
        )


class FitTests(unittest.TestCase):
    def test_fits_real_synthetic_responses_without_multiprocessing(self):
        data = pd.DataFrame(
            [
                {
                    "user_id": f"s{student}",
                    "skill_name": "M6.A",
                    "correct": correct,
                    "order_id": order,
                }
                for student, answers in enumerate(([1, 1, 0], [0, 1, 0], [1, 0, 1], [0, 0, 1]))
                for order, correct in enumerate(answers)
            ]
        )

        report = fit(data, seed=7)

        self.assertEqual(report["observations"], 12)
        self.assertEqual(report["students"], 4)
        self.assertEqual(len(report["skills"]), 1)
        self.assertEqual(report["skills"][0]["conceptId"], "M6.A")
        for name in ("pL0", "pT", "pG", "pS"):
            self.assertGreaterEqual(report["skills"][0][name], 0)
            self.assertLessEqual(report["skills"][0][name], 1)


if __name__ == "__main__":
    unittest.main()
