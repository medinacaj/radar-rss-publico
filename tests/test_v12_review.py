"""Guarda de regresión para la entrega interactiva de Radar RSS V1.2."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
class V12ReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html=(ROOT/'web/index.html').read_text(encoding='utf8')
        cls.script=(ROOT/'web/v12.js').read_text(encoding='utf8')
        cls.css=(ROOT/'web/v12.css').read_text(encoding='utf8')
        cls.features=(ROOT/'web/features.js').read_text(encoding='utf8')
        cls.sw=(ROOT/'web/sw.js').read_text(encoding='utf8')

    def test_modules_loaded_after_dependencies_and_cached_for_offline(self):
        self.assertLess(self.html.index('./features.js?v='),self.html.index('./v12.js?v='))
        self.assertIn('./v12.css?v=',self.html)
        self.assertIn("'./v12.css'",self.sw)
        self.assertIn("'./v12.js'",self.sw)

    def test_regions_preserve_original_opml_sections(self):
        self.assertIn("regionalCats()",self.script)
        self.assertIn("categoryLabel(cat)",self.script)
        self.assertIn("#region/latinoamerica",self.script)
        self.assertIn("goTo = function(target)",self.script)
        self.assertNotIn("v12-country-tab",self.script)

    def test_original_source_folder_navigation_not_replaced(self):
        # La agrupación regional es un filtro; no debe ocultar las carpetas OPML.
        self.assertNotIn("const navBase = buildNav",self.script)
        self.assertNotIn("folderNav.append(section)",self.script)
        self.assertNotIn("row.classList.add('v12-hidden-category')",self.script)
        self.assertIn("const railBase = renderTopicRail",self.script)
        self.assertIn("v12.js?v=1.3.0",self.html)
        self.assertIn("radar-rss-v28",self.sw)

    def test_all_news_context_and_coverage_have_separate_responsibilities(self):
        library=(ROOT/'web/library.js').read_text(encoding='utf8')
        self.assertIn("if(kind==='all')",library)
        self.assertIn("Marcar todas como leídas",library)
        self.assertIn("Mostrar solo las no leídas",library)
        self.assertIn("void markAllNewsRead()",library)
        self.assertIn("await loadHistory()",library)
        app=(ROOT/'web/app.js').read_text(encoding='utf8')
        self.assertIn("key === 'radar-read' ? -5000 : -4000",app)
        self.assertIn("setNavOpen(false,false)",library)
        self.assertNotIn("makeSelect('v12Geo'",self.script)
        self.assertNotIn("id='v12CountryTabs'",self.script)
        self.assertIn("controls.insertBefore(datePicker.wrap,bulkRead)",self.script)
        self.assertIn("['chile','venezuela','region'].includes(item.geo)",self.script)
        self.assertIn("goTo(catOf(item.geo))",self.script)
        self.assertIn("chooseGeo(item.geo==='latam'?'latam':'all')",self.script)
        self.assertIn("savedSearches.length>=12",self.script)
        self.assertNotIn("Todos los países",self.script)

    def test_feed_toolbar_is_compact_and_not_duplicated(self):
        app=(ROOT/'web/app.js').read_text(encoding='utf8')
        self.assertNotIn('id="v12FilterBar"',self.html)
        self.assertNotIn('class="feed-actions"',self.html)
        self.assertNotIn("const filterRow=mk",self.script)
        self.assertIn("controls.insertBefore(datePicker.wrap,bulkRead)",self.script)
        self.assertIn("controls.insertBefore(saveSearch,bulkRead)",self.script)
        self.assertIn("datePicker.select.title='Filtrar por antigüedad'",self.script)
        self.assertIn("saveSearch.setAttribute('aria-label'",self.script)
        self.assertIn('class="feed-tool-action"',self.html)
        self.assertIn('id="filterSummary" class="sr-only"',self.html)
        self.assertIn("'markAllVisible').disabled=!visible.some",app)
        self.assertIn(".filter-controls .v12-toolbar-age",self.css)
        self.assertIn(".v12-save-icon,#markAllVisible",self.css)

    def test_home_categories_not_duplicated_in_dashboard(self):
        self.assertIn("document.querySelector('[data-settings-pane=\"reading\"]')",self.script)
        self.assertIn("grid.after(section)",self.script)
        self.assertNotIn("querySelector('.dashboard-head').after(section)",self.script)
        self.assertIn("v12MineDetails",self.script)
        guide=(ROOT/'web/v13.js').read_text(encoding="utf8")
        self.assertIn("selectedTab('reading')",guide)
        self.assertIn("reading.append(panel)",guide)
        self.assertNotIn("head.after(panel)",guide)

    def test_personalization_is_local_and_limits_saved_searches(self):
        self.assertIn("radar-v12-preferences",self.script)
        self.assertIn("radar-v12-saved-searches",self.script)
        self.assertIn("localStorage.setItem",self.script)
        self.assertIn("savedSearches.length>=12",self.script)
        self.assertIn("window.RadarV12.dashboardMatch", (ROOT/'web/app.js').read_text(encoding='utf8'))

    def test_briefing_uses_same_filtered_source_for_copy_audio_share(self):
        self.assertIn("window.RadarV12.briefingCategories()",self.features)
        self.assertIn("briefingText(briefingData(), 3)",self.features)
        self.assertIn("const data = briefingData();",self.features)
        self.assertIn("briefingText(data)",self.features)

    def test_accessible_mobile_actions(self):
        self.assertIn("aria-label",self.script)
        self.assertIn("aria-pressed",self.script)
        self.assertIn("v12-myradar",self.css)
        self.assertIn("@media(max-width:710px)",self.css)
        self.assertNotIn("innerHTML",self.script)

if __name__=="__main__":
    unittest.main()
