"""No duplicate update strip or GitHub link in the compact topbar."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class CompactTopbarTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html=(ROOT/'web/index.html').read_text(encoding='utf-8')
        cls.app=(ROOT/'web/app.js').read_text(encoding='utf-8')
        cls.css=(ROOT/'web/radar-hybrid.css').read_text(encoding='utf-8')

    def test_compact_single_header(self):
        html=self.html
        self.assertEqual(html.count('id="refreshCycle"'),1)
        # La cuenta regresiva se reemplazó por «Actualizado hace…» (se confundía con una hora).
        self.assertNotIn('id="refreshCycleTime"',html)
        self.assertIn('function freshnessLabel()',self.app)
        self.assertEqual(html.count('id="refreshNow"'),1)
        self.assertLess(html.index('id="refreshCycle"'),html.index('</header>'))
        self.assertNotIn('id="githubLink"',html)
        self.assertNotIn('class="refresh-cycle"',html)
        self.assertNotIn('id="refreshCycleProgress"',html)
        self.assertNotIn('id="refreshCycleFill"',html)

    def test_keep_15_min_client_and_three_hour_source_distinct(self):
        self.assertIn('const CHECK_INTERVAL_MS=15*60*1000',self.app)
        self.assertIn('cada 15 minutos',self.app)
        self.assertIn('cada 3 horas',self.app)
        self.assertIn('refreshPublishedData()',self.app)
        self.assertIn("('refreshNow').addEventListener('click'",self.app)
        self.assertIn('id="lastUpdate"',self.html)
        self.assertIn('id="feedHealthIndicator"',self.html)
        self.assertNotIn("'refreshCycleProgress'",self.app)
        self.assertNotIn("'refreshCycleFill'",self.app)

    def test_accessibility_and_responsive(self):
        self.assertIn('aria-label="Comprobar novedades ahora"',self.html)
        self.assertIn('role="group"',self.html)
        self.assertIn('body.radar-hybrid .topbar-refresh',self.css)
        self.assertIn('@media(max-width:430px)',self.css)
        self.assertRegex(self.html,r'<link rel="stylesheet" href="\./radar-hybrid\.css\?v=[^"]+">')
        self.assertRegex(self.html,r'<script src="\./app\.js\?v=[^"]+" defer></script>')
