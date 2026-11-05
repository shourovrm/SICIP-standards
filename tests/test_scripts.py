"""The parsing helpers in scripts/ that decide approved dates and equipment quantities.
Run with PYTHONPATH=scripts (`just test` does)."""

import unittest

from build_lab_standard import parse_quantity
from build_peer_data import parse_date


class ParseDateTest(unittest.TestCase):
    def test_formats_found_in_cs_file_names(self):
        cases = {
            "BEIOA_FINAL (M)_CS_Machine Shop Practice for BEIOA 03072025.pdf": "03 Jul 2025",
            "CS Welding 28 May 2025.pdf": "28 May 2025",
            "CS Plumbing 7.1.25.pdf": "07 Jan 2025",
            "CS_Masonry_15 Sept'25.pdf": "15 Sep 2025",
        }
        for filename, expected in cases.items():
            with self.subTest(filename=filename):
                self.assertEqual(parse_date(filename), expected)

    def test_no_date_gives_none(self):
        self.assertIsNone(parse_date("Competency Standard Welding.pdf"))


class ParseQuantityTest(unittest.TestCase):
    def test_numbers_and_text(self):
        cases = {
            3: (3, None),
            "3 sets (min)": (3, "3 sets (min)"),
            "several": (None, "several"),
            True: (None, None),
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(parse_quantity(raw), expected)


if __name__ == "__main__":
    unittest.main()
