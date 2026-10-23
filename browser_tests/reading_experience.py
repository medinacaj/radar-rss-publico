#!/usr/bin/env python3
"""Exercise real reading flows with local RSS fixtures and no publisher requests."""
from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile
import threading
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

from responsive_smoke import RESPONSES, STAMP

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-results' / 'reading-experience'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def exercise(browser, base, width):
    responses = copy.deepcopy(RESPONSES)
    errors = []
    context = browser.new_context(
        viewport={'width': width, 'height': 900},
        ignore_https_errors=True, service_workers='block',
        is_mobile=width <= 640, has_touch=width <= 640,
    )
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))

    def data_route(route):
        name = urlsplit(route.request.url).path.rsplit('/', 1)[-1]
        route.fulfill(status=200 if name in responses else 404,
                      content_type='application/json', body=json.dumps(responses.get(name, {})))

    context.route('**/data/**', data_route)
    context.route('https://example.com/**', lambda route: route.fulfill(
        status=200, content_type='image/svg+xml',
        body='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#ccc"/></svg>',
    ))
    try:
        page.goto(base + '#noticias', wait_until='networkidle')
        expect(page.locator('#articleGrid .article-card')).to_have_count(18)
        if width <= 640:
            expect(page.locator('#sourceSelect')).not_to_be_visible()
            page.locator('#feedFiltersToggle').click()
            expect(page.locator('#sourceSelect')).to_be_visible()
        page.select_option('#sourceSelect', 'medio-0')
        if width > 640:
            page.locator('#feedAdvanced > summary').click()
        page.select_option('#v12Date', '7')
        if width <= 640:
            page.locator('#searchToggle').click()
        page.locator('#searchInput').fill('referencia')
        expect(page.locator('.feed-filter-chip')).to_have_count(3)
        expect(page.locator('.feed-filter-chip[data-filter="source"]')).to_contain_text('Medio de referencia 0')
        if width <= 640:
            expect(page.locator('#feedFiltersCount')).to_have_text('3')
            page.locator('#feedFiltersToggle').click()
        page.screenshot(path=str(OUTPUT / f'filters-{width}.png'))
        page.locator('#feedClearFilters').click()
        expect(page.locator('.feed-filter-chip')).to_have_count(0)
        expect(page.locator('#articleGrid .article-card')).to_have_count(18)

        # Global preferences stay explicit and survive clearing list filters.
        page.evaluate("state.hideRead=true;state.hiddenSources.add('medio-5');state.mutedKeywords='fútbol';state.search='referencia';render()")
        page.locator('#feedClearFilters').click()
        assert page.evaluate("state.hideRead&&state.hiddenSources.has('medio-5')&&state.mutedKeywords==='fútbol'")
        expect(page.locator('#feedClearFilters')).not_to_be_visible()
        page.locator('[data-filter="hide-read"]').click()
        expect(page.locator('#settingsDialog')).to_be_visible()
        page.locator('#settingsDone').click()
        page.evaluate("state.hideRead=false;state.hiddenSources.clear();state.mutedKeywords='';render()")

        if width <= 640 and not page.locator('#searchInput').is_visible():
            page.locator('#searchToggle').click()
        page.locator('#searchInput').fill('coincidencia-inexistente-zzzz')
        expect(page.locator('.feed-empty-title')).to_contain_text('Sin resultados')
        page.get_by_role('button', name='Borrar búsqueda', exact=True).click()
        expect(page.locator('#articleGrid .article-card')).to_have_count(18)

        # Undo reverses this batch, retaining a prior read and a later unrelated one.
        page.evaluate("state.read.clear();markRead('noticia-0',true)")
        expect(page.locator('[data-article-id="noticia-0"] .article-read-toggle')).to_have_attribute('aria-pressed', 'true')
        assert page.evaluate("state.read.size===1&&state.read.has('noticia-0')")
        if width <= 640:
            if page.locator('#feedFiltersToggle').get_attribute('aria-expanded') != 'true':
                page.locator('#feedFiltersToggle').click()
        else:
            page.locator('#feedAdvanced').evaluate('(node)=>node.open=true')
        page.locator('#markAllVisible').click()
        expect(page.locator('#actionToast')).to_contain_text('17 noticias')
        page.evaluate("state.read.add('otra-noticia-concurrente')")
        page.get_by_role('button', name='Deshacer', exact=True).click()
        assert page.evaluate("state.read.size===2&&state.read.has('noticia-0')&&state.read.has('otra-noticia-concurrente')")

        card = page.locator('#articleGrid .article-card').nth(4)
        card.scroll_into_view_if_needed()
        original_y = page.evaluate('window.scrollY')
        card.locator('.article-title a').click()
        expect(page.locator('#readerPosition')).to_have_text('5 de 18')
        page.locator('#readerNext').click()
        expect(page.locator('#readerPosition')).to_have_text('6 de 18')
        page.locator('#readerNext').press('k')
        expect(page.locator('#readerPosition')).to_have_text('5 de 18')
        page.locator('#readerUnread').click()
        assert page.evaluate("!state.read.has('noticia-4')")
        page.screenshot(path=str(OUTPUT / f'reader-{width}.png'))
        page.locator('#readerClose').click()
        page.wait_for_function("document.activeElement?.closest('[data-article-id]')?.dataset.articleId==='noticia-4'")
        assert abs(page.evaluate('window.scrollY') - original_y) <= 2

        # A new publication is staged without redrawing the reader's list.
        new_stamp = (datetime.fromisoformat(STAMP.replace('Z', '+00:00')) + timedelta(minutes=1)).isoformat().replace('+00:00', 'Z')
        extra = dict(responses['latest.json']['items'][0], id='nueva-referencia', title='Nueva noticia de referencia')
        responses['latest.json']['items'].insert(0, extra)
        responses['latest.json']['generated_at'] = new_stamp
        responses['status.json']['checked_at'] = new_stamp
        responses['meta.json'].update(generated_at=new_stamp, total_articles=19, latest_count=19)
        before = page.evaluate('({ids:state.items.map(item=>item.id),y:window.scrollY})')
        page.evaluate('refreshPublishedData()')
        expect(page.locator('#publicationNotice')).to_be_visible()
        expect(page.locator('#publicationMessage')).to_have_text('Hay 1 noticia nueva')
        assert page.evaluate('state.items.map(item=>item.id)') == before['ids']
        assert page.evaluate('window.scrollY') == before['y']
        page.locator('#publicationApply').click()
        expect(page.locator('#publicationNotice')).not_to_be_visible()
        assert page.evaluate('state.items[0].id') == 'nueva-referencia'

        page.evaluate("setTheme('dark',true);window.scrollTo(0,0)")
        page.screenshot(path=str(OUTPUT / f'dark-{width}.png'))
        page.evaluate("setTheme('light',true);window.scrollTo(0,0)")
        page.screenshot(path=str(OUTPUT / f'feed-{width}.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'), f'Overflow at {width}px'
        assert not errors, errors
        print(f'{width}px: filters, mobile controls, recovery, Undo, reader navigation, return position and staged publication OK', flush=True)
    except Exception:
        page.screenshot(path=str(OUTPUT / f'failure-{width}.png'))
        raise
    finally:
        context.close()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        cert, key = Path(temporary) / 'cert.pem', Path(temporary) / 'key.pem'
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(key),
                        '-out', str(cert), '-days', '1', '-subj', '/CN=localhost'], check=True, capture_output=True)
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'web')))
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.load_cert_chain(cert, key)
        server.socket = tls.wrap_socket(server.socket, server_side=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, executable_path=shutil.which('chromium'),
                                                      args=['--no-sandbox', '--disable-dev-shm-usage'])
                try:
                    for width in (320, 390, 768, 1440):
                        exercise(browser, f'https://127.0.0.1:{server.server_port}/', width)
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == '__main__':
    main()
