"""Сквозные проверки стенда «Свет и волны» (оптика, цвета, решётка, линза).
Запуск: python3 src/smoke_optics.py   (нужен локально запущенный server.js)
"""
import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('c:' + m.text) if m.type == 'error' else None)
        await pg.goto('http://127.0.0.1:8082/', wait_until='networkidle')

        await pg.click('button[data-bench="optics"]')
        await pg.wait_for_timeout(900)
        assert await pg.evaluate("() => document.querySelectorAll('#oTaskList button').length") == 8

        # 1. Снелл: три угла воздух → вода
        for a in ['10', '30', '60']:
            await pg.evaluate("(v)=>{const e=document.getElementById('oA'); e.value=v;"
                              "e.dispatchEvent(new Event('input',{bubbles:true}));}", a)
            await pg.click('#oSampleRefract')
            await pg.wait_for_timeout(120)
        await pg.click('#oTaskList button:nth-child(1)')
        await pg.wait_for_timeout(200)
        await pg.click('#oCheck')
        await pg.wait_for_timeout(300)
        assert 'выполнено' in (await pg.inner_text('#oCheckOut')), 'задание 1 (Снелл)'
        f = await pg.evaluate("() => window.__optics.facts()")
        assert abs(f['nMeasured'] - 1.333) < 0.05, f['nMeasured']
        print('оптика: закон Снелла — измеренный n =', round(f['nMeasured'], 3))

        # 2. Полное внутреннее отражение: вода → воздух
        for bt in await (await pg.query_selector('#oN1')).query_selector_all('button'):
            if (await bt.get_attribute('data-n')) == 'water':
                await bt.click()
                break
        for bt in await (await pg.query_selector('#oN2')).query_selector_all('button'):
            if (await bt.get_attribute('data-n')) == 'air':
                await bt.click()
                break
        for a in ['30', '55', '70']:
            await pg.evaluate("(v)=>{const e=document.getElementById('oA'); e.value=v;"
                              "e.dispatchEvent(new Event('input',{bubbles:true}));}", a)
            await pg.click('#oSampleRefract')
            await pg.wait_for_timeout(120)
        await pg.click('#oTaskList button:nth-child(2)')
        await pg.wait_for_timeout(200)
        await pg.click('#oCheck')
        await pg.wait_for_timeout(300)
        assert 'выполнено' in (await pg.inner_text('#oCheckOut')), 'задание 2 (ПВО)'
        print('оптика: полное внутреннее отражение — задание 2 выполнено')

        # 3. Смешение цветов: R+G, затем +B
        await pg.click('#oMode button[data-mode="color"]')
        await pg.wait_for_timeout(350)
        await pg.click('#oCh button[data-ch="g"]')
        await pg.wait_for_timeout(150)
        await pg.click('#oSampleColor')
        await pg.wait_for_timeout(150)
        await pg.click('#oCh button[data-ch="b"]')
        await pg.wait_for_timeout(150)
        await pg.click('#oSampleColor')
        await pg.wait_for_timeout(200)
        await pg.click('#oTaskList button:nth-child(3)')
        await pg.wait_for_timeout(200)
        await pg.click('#oCheck')
        await pg.wait_for_timeout(300)
        assert 'выполнено' in (await pg.inner_text('#oCheckOut')), 'задание 3 (смешение)'
        assert (await pg.inner_text('#oCapKind')).lower() == 'белый', 'на экране должен быть белый'
        print('оптика: смешение R+G+B — на экране белый, задание 3 выполнено')

        # 4. Решётка: красный дальше фиолетового
        await pg.click('#oMode button[data-mode="grating"]')
        await pg.wait_for_timeout(350)
        angles = {}
        for wl in ['700', '410']:
            await pg.evaluate("(v)=>{const e=document.getElementById('oGl'); e.value=v;"
                              "e.dispatchEvent(new Event('input',{bubbles:true}));}", wl)
            await pg.click('#oSampleGrating')
            await pg.wait_for_timeout(120)
            angles[wl] = float((await pg.inner_text('#oLcd')).replace(',', '.'))
        assert angles['700'] > angles['410'], angles
        await pg.click('#oTaskList button:nth-child(5)')
        await pg.wait_for_timeout(200)
        await pg.click('#oCheck')
        await pg.wait_for_timeout(300)
        assert 'выполнено' in (await pg.inner_text('#oCheckOut')), 'задание 5 (решётка)'
        print('оптика: решётка — 700 нм', angles['700'], '° > 410 нм', angles['410'], '°')

        # 5. Линза: F=20, d=30 → действительное, ×2
        await pg.click('#oMode button[data-mode="lens"]')
        await pg.wait_for_timeout(350)
        await pg.click('#oSampleLens')
        await pg.wait_for_timeout(150)
        await pg.click('#oTaskList button:nth-child(7)')
        await pg.wait_for_timeout(200)
        await pg.click('#oCheck')
        await pg.wait_for_timeout(300)
        assert 'выполнено' in (await pg.inner_text('#oCheckOut')), 'задание 7 (линза)'
        print('оптика: линза F=20 см, d=30 см — f =', await pg.inner_text('#oLcd'), 'см, задание 7 выполнено')

        # протокол и CSV
        n_points = await pg.evaluate("() => window.__optics.lab.measures.length")
        assert n_points >= 8, n_points
        assert not errs, errs[:4]
        print('оптика: 8 заданий, точек в протоколе', n_points, '— ошибок нет')
        await b.close()


asyncio.run(main())
