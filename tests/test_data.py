"""data/data.json is what the whole site renders.
These tests keep it consistent with the files it points to."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPROVED = re.compile(r"^\d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$")


def slug(text):
    """Same as slug() in web/js/app.js."""
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", "and")))


def course_slug(entry):
    """Same as cSlug() in web/js/app.js: the course's URL and its data/xlsx file name."""
    return re.sub(r"[^a-z0-9]+", "-", entry["org_slug"].lower()) + "--" + slug(entry["course_name"])


class DataTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = json.loads((ROOT / "data" / "data.json").read_text(encoding="utf-8"))

    def test_has_courses(self):
        self.assertTrue(self.entries)

    def test_course_urls_are_unique(self):
        slugs = [course_slug(e) for e in self.entries]
        duplicates = sorted({s for s in slugs if slugs.count(s) > 1})
        self.assertEqual(duplicates, [])

    def test_every_course_has_its_files(self):
        for e in self.entries:
            with self.subTest(course=course_slug(e)):
                self.assertTrue((ROOT / e["xlsx"]).exists(), e["xlsx"])
                self.assertTrue((ROOT / "data" / "xlsx" / f"{course_slug(e)}.xlsx").exists())
                if e["cs_pdf"]:
                    self.assertTrue((ROOT / e["cs_pdf"]).exists(), e["cs_pdf"])

    def test_approved_dates_are_formatted_or_empty(self):
        for e in self.entries:
            with self.subTest(course=course_slug(e)):
                self.assertTrue(
                    e["approved"] is None or APPROVED.match(e["approved"]), e["approved"]
                )

    def test_equipment_can_be_scored(self):
        for e in self.entries:
            with self.subTest(course=course_slug(e)):
                self.assertIsInstance(e["trainees"], int)
                self.assertTrue(e["equipment"])
                self.assertGreater(sum(row["weight"] or 0 for row in e["equipment"]), 0)

    def test_minimum_rules_point_at_real_rows(self):
        for e in self.entries:
            with self.subTest(course=course_slug(e)):
                for rule in e["min_rules"]:
                    self.assertLess(rule["row"], len(e["equipment"]))


if __name__ == "__main__":
    unittest.main()
