"""Run the interaction regressions in the normal Python/Actions test entrypoint."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which('node'), 'Node is required for frontend interaction checks')
class ReadingExperienceTests(unittest.TestCase):
    def test_interactions(self):
        for script in ('test_feed_ux.cjs', 'test_reading_state.cjs', 'test_reader_ux.cjs'):
            with self.subTest(script=script):
                result = subprocess.run(
                    ['node', str(ROOT / 'tests' / script)], cwd=ROOT,
                    capture_output=True, text=True, timeout=30,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_offline_shell_contains_each_local_entrypoint(self):
        import re
        html = (ROOT / 'web' / 'index.html').read_text(encoding='utf8')
        shell = (ROOT / 'web' / 'sw.js').read_text(encoding='utf8')
        for path in re.findall(r'(?:src|href)="\./([^"?]+)(?:\?[^\"]*)?"', html):
            if path.endswith(('.css', '.js')):
                with self.subTest(path=path):
                    self.assertTrue((ROOT / 'web' / path).is_file())
                    self.assertIn("'./" + path + "'", shell)
