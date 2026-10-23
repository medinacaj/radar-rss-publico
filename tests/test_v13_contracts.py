"""V1.3 contract checks for onboarding, offline shell and bounded history."""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class V13Contracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=(ROOT/'web/app.js').read_text(encoding="utf8")
        cls.lib=(ROOT/'web/library.js').read_text(encoding="utf8")
        cls.html=(ROOT/'web/index.html').read_text(encoding="utf8")
        cls.sw=(ROOT/'web/sw.js').read_text(encoding="utf8")
        cls.js=(ROOT/'web/v13.js').read_text(encoding="utf8")
        cls.workflow=(ROOT/'.github/workflows/deploy.yml').read_text(encoding="utf8")

    def test_shell_order_and_cache(self):
        self.assertLess(self.html.index('v12.js?v='),self.html.index('v13.js?v='))
        self.assertIn('v13.css?v=',self.html)
        self.assertIn("'./v13.js'",self.sw)
        self.assertIn("'./v13.css'",self.sw)

    def test_home_has_one_clear_navigation_to_all_news(self):
        self.assertNotIn('Explorar todas las noticias',self.html)
        self.assertNotIn('class="dashboard-read-all" href="#noticias"',self.html)
        self.assertIn('id="categoryNav"',self.html)
        self.assertIn('id="dashboardSavedAll"',self.html)
        self.assertIn("target===\'all\'?\'#noticias\'",self.app)

    def test_home_starts_with_news_not_promotional_copy(self):
        self.assertIn('<h1 id="dashboardTitle" class="sr-only">Portada de Radar RSS</h1>',self.html)
        self.assertNotIn('Noticias para estar al día.',self.html)
        self.assertNotIn('Una lectura clara de la actualidad',self.html)
        self.assertNotIn('class="dashboard-head"',self.html)
        self.assertNotIn('class="hero"',self.html)
        self.assertNotIn('id="settingHero"',self.html)
        self.assertNotIn('state.showHero',self.app)
        self.assertLess(self.html.index('id="dashboardFeature"'),self.html.index('id="sinceVisit"'))
        self.assertIn('id="dashboardRecentTitle"',self.html)
        self.assertIn('id="dashboardFoldersTitle"',self.html)
        self.assertIn('id="dashboardSavedAll"',self.html)

    def test_v11_bento_has_real_asymmetric_structure(self):
        css=(ROOT/'web/v13.css').read_text(encoding='utf8')
        self.assertIn('class="newsroom-lead" id="newsroomLead"',self.html)
        self.assertIn('newsroom-lead-stories',self.html)
        self.assertIn('newsroom-lead-latest',self.html)
        self.assertLess(self.html.index('id="topicRail"'),self.html.index('<main class="main"'))
        self.assertIn('grid-template-columns:minmax(0,8fr) minmax(290px,4fr)',css)
        self.assertIn('.newsroom-lead .dashboard-feature',css)
        self.assertIn('grid-column:span 7;grid-row:span 2',css)
        self.assertIn('body.radar-hybrid .sidebar-backdrop:not([hidden])',css)
        self.assertIn('const MOBILE_NAV=window.matchMedia(\'(min-width: 0px)\')',self.app)
        self.assertIn('body.radar-hybrid .topic-rail{',css)
        self.assertIn('class="newsroom-discovery" id="newsroomDiscovery"',self.html)
        self.assertIn('newsroom-discovery-aside',self.html)
        self.assertIn('grid-template-columns:repeat(12,minmax(0,1fr))',css)
        self.assertIn('V11.1 · BENTO GRID auténtico',css)
        self.assertNotIn('Noticias para estar al día.',self.html)
        self.assertIn('sidebar-layout.js?v=1.1.0',self.html)

    def test_onboarding_actions_are_only_in_reading_settings(self):
        for token in ["v13GuideTitle","aria-labelledby",
                      "settings-reading-help","settings-reading-action",
                      "Personalizar temas","Combinar filtros","Comparar titulares"]:
            self.assertIn(token,self.js)
        self.assertIn("'[data-settings-pane=\"reading\"]'",self.js)
        self.assertNotIn("head.after(panel)",self.js)
        self.assertNotIn("v13DismissGuide",self.js)
        self.assertNotIn("v13OpenGuide",self.js)
        self.assertNotIn("Empieza con Radar RSS",self.js)
        self.assertNotIn("fetch(",self.js)
        self.assertNotIn("sendBeacon",self.js)

    def test_history_is_bounded_and_inactive_feed_is_not_drawn(self):
        self.assertIn("Math.min(3,files.length)",self.app)
        self.assertIn("if(state.pageView==='feed')",self.app)
        self.assertIn("grid.replaceChildren();",self.app)

    def test_save_restores_keyboard_focus(self):
        self.assertIn("const restoreFocus=document.activeElement",self.lib)
        self.assertIn("button.focus({preventScroll:true})",self.lib)

    def test_card_height_fix_only_targets_grid_not_editorial_or_list(self):
        css=(ROOT/'web/v13.css').read_text(encoding='utf8')
        self.assertIn('#articleGrid.article-grid:not(.list-view)',css)
        self.assertIn('grid-auto-rows:auto',css)
        self.assertNotIn('grid-auto-rows:1fr',css)
        self.assertIn('> .article-card .article-footer',css)
        self.assertIn('> .article-card > .cover',css)
        self.assertIn('height:clamp(112px,11vw,148px)',css)
        self.assertIn('height:76px;max-height:76px',css)
        self.assertIn('body.radar-hybrid.compact #articleGrid',css)
        self.assertNotIn('.dashboard-feature .article-card{grid-auto-rows',css)
        self.assertIn('v13.css?v=7.1.0',self.html)
        self.assertIn('Portada editorial V5.3',css)
        self.assertIn('grid-template-columns:repeat(3,minmax(0,1fr))',css)
        self.assertIn("radar-rss-v28",self.sw)

    def test_card_read_action_is_visible_and_syncs_values(self):
        self.assertIn("article-action article-read-toggle",self.app)
        self.assertIn("Marcar como leída",self.app)
        self.assertIn("addEventListener('contextmenu'",self.app)
        self.assertIn("toggleCardMenu(item,more,{x:event.clientX,y:event.clientY})",self.app)
        self.assertIn("render();",self.app)
        self.assertIn("sin leer con estos filtros",self.app)
        self.assertIn("aria-keyshortcuts','Shift+F10'",self.app)
        css=(ROOT/'web/v13.css').read_text(encoding='utf8')
        self.assertIn("#articleGrid .article-card:hover",css)
        self.assertIn("article-read-toggle[aria-pressed",css)
        self.assertIn("@media(prefers-reduced-motion:reduce)",css)

    def test_read_button_remains_icon_only(self):
        self.assertIn("read.append(svgIcon(isRead?'undo':'check'));",self.app)
        self.assertNotIn("article-read-label",self.app)
        self.assertIn("read.title=readLabel",self.app)
        self.assertIn("read.setAttribute('aria-label'",self.app)
        self.assertIn("read.setAttribute('aria-pressed'",self.app)
        css=(ROOT/'web/v13.css').read_text(encoding="utf8")
        self.assertIn("width:38px;height:38px;min-width:38px",css)

    def test_missing_photos_are_labeled_not_invented(self):
        self.assertIn("function editorialCover(item)",self.app)
        self.assertIn("Sin fotografía disponible",self.app)
        self.assertIn("article-cover-placeholder",self.app)
        self.assertIn("el.classList.add('no-excerpt')",self.app)
        self.assertIn("state.showImages",self.app)
        self.assertIn("img.addEventListener('error'",self.app)
        self.assertNotIn("images.unsplash.com",self.app)

    def test_read_and_unread_get_distinct_subtle_elevations(self):
        self.assertIn("'unread-card'",self.app)
        css=(ROOT/'web/v13.css').read_text(encoding="utf8")
        self.assertIn(".article-card.unread-card",css)
        self.assertIn(".article-card.read-article",css)
        self.assertIn("box-shadow:0 1px 2px",css)
        self.assertIn(".article-card.no-excerpt",css)
        self.assertIn(".article-cover-placeholder",css)
        self.assertIn("@media(hover:hover) and (pointer:fine)",css)
        self.assertIn("@media(prefers-reduced-motion:reduce)",css)

    def test_backup_is_retained_and_manual_recovery_checks_integrity(self):
        self.assertIn("retention-days: 90",self.workflow)
        self.assertIn("python scripts/validate_restore.py",self.workflow)
        self.assertIn('inputs.restore_run_id',self.workflow)
        self.assertIn("python scripts/audit_editorial.py",self.workflow)

if __name__=="__main__":
    unittest.main()
