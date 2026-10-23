"""Guard rails for the resizable sidebar, its responsive behavior, and backup support."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class SidebarLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html=(ROOT/'web/index.html').read_text(encoding='utf-8')
        cls.css=(ROOT/'web/sidebar-layout.css').read_text(encoding='utf-8')
        cls.script=(ROOT/'web/sidebar-layout.js').read_text(encoding='utf-8')
        cls.app=(ROOT/'web/app.js').read_text(encoding='utf-8')
        cls.library=(ROOT/'web/library.js').read_text(encoding='utf-8')

    def test_handle_keyboard_and_desktop_only(self):
        for token in ('role="separator"','aria-orientation="vertical"',
                      'id="sidebarResizeHandle"','id="settingSidebarWidth"'):
            self.assertIn(token,self.html)
        for token in ("'ArrowLeft'","'ArrowRight'","'Home'","'End'",
                      "'pointercancel'","'pointermove'","'dblclick'"):
            self.assertIn(token,self.script)
        self.assertIn('@media(max-width:950px)',self.css)
        self.assertIn('.sidebar-resize-handle{display:none!important}',self.css)
        self.assertIn("isDesktop()",self.script)

    def test_css_has_single_variable_and_mobile_override(self):
        self.assertIn('--radar-sidebar-width:310px',self.css)
        self.assertIn('grid-template-columns:minmax(0,var(--radar-sidebar-width))',self.css)
        self.assertIn('body.radar-hybrid .app-shell{grid-template-columns:minmax(0,1fr)}',self.css)

    def test_persistence_reset_and_v3_backup(self):
        self.assertIn("'radar-sidebar-width'",self.script)
        self.assertIn("'sidebar-width'",self.app)
        self.assertIn('sidebarWidth:Number(localStorage.getItem',self.library)
        self.assertIn("window.dispatchEvent(new Event('radar-sidebar-pref-sync'))",self.library)
        self.assertIn("window.dispatchEvent(new Event('radar-sidebar-pref-sync'))",self.app)

    def test_scripts_are_in_correct_order(self):
        # Verificar el orden de carga sin acoplar las pruebas al número de versión.
        import re
        scripts=re.findall(r'<script src="\./([^"?]+\.js)(?:\?v=[^"]+)?" defer></script>',self.html)
        self.assertEqual(scripts,['app.js','library.js','sidebar-layout.js','news-effects.js','features.js','v12.js','v13.js','feed-ux.js','reader-ux.js'])
        self.assertRegex(self.html,r'<link rel="stylesheet" href="\./sidebar-layout\.css\?v=[^"]+">')
        self.assertLess(self.html.index('sidebar-layout.css?v='),self.html.index('</head>'))
