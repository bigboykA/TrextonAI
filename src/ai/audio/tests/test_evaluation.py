from __future__ import annotations

import unittest

from src.ai.audio.evaluation import (
    Interval,
    annotation_template,
    calculate_metrics,
    evaluate_candidates,
    match_intervals,
)


class AudioEventEvaluationTests(unittest.TestCase):
    def test_matching_is_one_to_one(self) -> None:
        predictions = [
            Interval(0.0, 10.0, 0.9),
            Interval(1.0, 9.0, 0.8),
        ]
        references = [
            Interval(0.0, 5.0),
            Interval(5.0, 10.0),
        ]
        matches = match_intervals(
            predictions,
            references,
            iou_threshold=0.3,
        )

        self.assertEqual(len(matches), 2)
        self.assertEqual(
            len({match[0] for match in matches}),
            len(matches),
        )
        self.assertEqual(
            len({match[1] for match in matches}),
            len(matches),
        )

    def test_one_prediction_cannot_match_multiple_references(self) -> None:
        metrics = calculate_metrics(
            [Interval(0.0, 10.0, 0.9)],
            [Interval(0.0, 5.0), Interval(5.0, 10.0)],
            duration=3600.0,
            iou_threshold=0.3,
        )

        self.assertEqual(metrics["truePositives"], 1)
        self.assertEqual(metrics["falseNegatives"], 1)
        self.assertEqual(metrics["eventPrecision"], 1.0)
        self.assertEqual(metrics["eventRecall"], 0.5)

    def test_metrics_include_boundaries_false_positives_and_coverage(
        self,
    ) -> None:
        metrics = calculate_metrics(
            [
                Interval(9.0, 21.0, 0.9),
                Interval(100.0, 110.0, 0.4),
            ],
            [Interval(10.0, 20.0)],
            duration=3600.0,
            iou_threshold=0.3,
        )

        self.assertEqual(metrics["truePositives"], 1)
        self.assertEqual(metrics["falsePositives"], 1)
        self.assertEqual(metrics["falsePositivesPerHour"], 1.0)
        self.assertEqual(
            metrics["meanAbsoluteStartErrorSeconds"],
            1.0,
        )
        self.assertEqual(
            metrics["meanAbsoluteEndErrorSeconds"],
            1.0,
        )
        self.assertGreater(metrics["candidateCoverage"], 0)

    def test_threshold_sweep_reports_candidate_tradeoff(self) -> None:
        result = evaluate_candidates(
            [
                Interval(10.0, 20.0, 0.9),
                Interval(100.0, 110.0, 0.3),
            ],
            [Interval(10.0, 20.0)],
            duration=3600.0,
            annotation_counts={
                "confirmedKeep": 1,
                "confirmedReject": 0,
                "uncertain": 0,
            },
            sweep_thresholds=[0.2, 0.8],
        )

        self.assertTrue(result["available"])
        self.assertEqual(
            [row["candidateCount"] for row in result["thresholdSweep"]],
            [2, 1],
        )
        self.assertLess(
            result["thresholdSweep"][0]["eventPrecision"],
            result["thresholdSweep"][1]["eventPrecision"],
        )

    def test_empty_review_set_reports_evaluation_unavailable(self) -> None:
        result = evaluate_candidates(
            [Interval(10.0, 20.0, 0.9)],
            [],
            duration=60.0,
            annotation_counts={
                "confirmedKeep": 0,
                "confirmedReject": 0,
                "uncertain": 0,
            },
        )

        self.assertFalse(result["available"])
        self.assertIn("No independently reviewed", result["reason"])
        self.assertEqual(result["thresholdSweep"], [])

    def test_annotation_template_does_not_fabricate_labels(self) -> None:
        template = annotation_template("apex-legends", 1350.997312)

        self.assertEqual(template["version"], 1)
        self.assertEqual(len(template["recordings"]), 1)
        self.assertEqual(
            template["recordings"][0]["annotations"],
            [],
        )


if __name__ == "__main__":
    unittest.main()
