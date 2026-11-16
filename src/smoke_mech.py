"""Сквозные проверки новых стендов «Механика» и «Тепло и газы» (PhET-логика).
Запуск: python3 src/smoke_mech.py   (нужен локально запущенный server.js)
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

        await pg.click('button[data-bench="mech"]'); await pg.wait_for_timeout(700)
        assert await pg.evaluate("() => document.querySelectorAll('#mTaskList button').length") == 8
        for h in ['2', '4']:
            await pg.evaluate("(v)=>{const e=document.getElementById('mH');e.value=v;"
                              "e.dispatchEvent(new Event('input',{bubbles:true}));}", h)
            await pg.click('#mDrop'); await pg.wait_for_timeout(2600)
            await pg.click('#mSample'); await pg.wait_for_timeout(200)
        f = await pg.evaluate("() => window.__mech.facts()")
        assert 1.3 <= f['speedRatio'] <= 1.55, f['speedRatio']
        await pg.click('#mTaskList button:nth-child(2)'); await pg.wait_for_timeout(300)
        await pg.click('#mCheck'); await pg.wait_for_timeout(400)
        assert 'выполнено' in (await pg.inner_text('#mCheckOut'))
        print('механика: 8 заданий, v ∝ √h —', round(f['speedRatio'], 2))

        await pg.click('button[data-bench="thermal"]'); await pg.wait_for_timeout(800)
        for v in ['10', '5', '2.5']:
            await pg.evaluate("(x)=>{const e=document.getElementById('tV');e.value=x;"
                              "e.dispatchEvent(new Event('input',{bubbles:true}));}", v)
            await pg.click('#tSample'); await pg.wait_for_timeout(180)
        await pg.click('#tTaskList button:nth-child(1)'); await pg.wait_for_timeout(300)
        await pg.click('#tCheck'); await pg.wait_for_timeout(400)
        assert 'выполнено' in (await pg.inner_text('#tCheckOut'))
        await pg.click('#tMode button[data-mode="mix"]'); await pg.wait_for_timeout(250)
        await pg.click('#tMixGo'); await pg.wait_for_timeout(250)
        await pg.click('#tMode button[data-mode="chain"]'); await pg.wait_for_timeout(250)
        await pg.click('#tChainGo'); await pg.wait_for_timeout(200)
        f = await pg.evaluate("() => window.__thermal.facts()")
        assert f['mixPoints'] >= 1 and f['chainPoints'] >= 1
        print('тепло: 8 заданий, точек в протоколе', f['measures'])
        assert not errs, errs[:4]
        print('ошибок нет')
        await b.close()

asyncio.run(main())
