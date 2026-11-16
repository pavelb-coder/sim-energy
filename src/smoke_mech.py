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

        # свободное падение: две массы → задание 8
        await pg.click('#mFree'); await pg.wait_for_timeout(300)
        for m in ['10', '100']:
            await pg.evaluate("(v)=>{const e=document.getElementById('mM');e.value=v;"
                              "e.dispatchEvent(new Event('input',{bubbles:true}));}", m)
            await pg.click('#mDrop'); await pg.wait_for_timeout(900)
            await pg.click('#mSample'); await pg.wait_for_timeout(200)
        await pg.click('#mTaskList button:nth-child(8)'); await pg.wait_for_timeout(250)
        await pg.click('#mCheck'); await pg.wait_for_timeout(350)
        assert 'выполнено' in (await pg.inner_text('#mCheckOut'))
        print('механика: свободное падение — задание 8 выполнено')

        # маятник: тяга и шар поворачиваются от одного центра (раньше тяга уходила в другую сторону)
        await pg.uncheck('#mFree'); await pg.wait_for_timeout(200)
        for bt in await (await pg.query_selector('#mScene')).query_selector_all('button'):
            if (await bt.get_attribute('data-scene')) == 'pendulum':
                await bt.click(); break
        await pg.evaluate("()=>{const e=document.getElementById('mA'); e.value=50;"
                          "e.dispatchEvent(new Event('input',{bubbles:true}));}")
        await pg.click('#mSwing'); await pg.wait_for_timeout(900)
        gap = await pg.evaluate("""() => {
          const rod = document.querySelector('#mRod'), line = rod.querySelector('line');
          const svg = rod.ownerSVGElement, pt = svg.createSVGPoint();
          pt.x = +line.getAttribute('x2'); pt.y = +line.getAttribute('y2');
          const end = pt.matrixTransform(rod.getScreenCTM());
          const zero = svg.createSVGPoint();                       // центр шара — это (0,0) в его координатах
          const bob = zero.matrixTransform(document.querySelector('#mBob').getScreenCTM());
          return Math.hypot(end.x - bob.x, end.y - bob.y);
        }""")
        assert gap < 3, f'тяга не совпадает с шаром: {gap:.1f} px'
        print('механика: маятник — тяга и шар на одной линии, расхождение', round(gap, 1), 'px')

        # пружина: энергия не нулевая при движении
        for bt in await (await pg.query_selector('#mScene')).query_selector_all('button'):
            if (await bt.get_attribute('data-scene')) == 'spring':
                await bt.click(); break
        await pg.click('#mPull'); await pg.wait_for_timeout(700)
        f = await pg.evaluate("() => window.__mech.facts()")
        e = await pg.inner_text('#mLcdE')
        assert e.replace(',', '.') and float(e.replace(',', '.')) > 0, e
        print('механика: пружина — полная энергия', e, 'Дж')

        await pg.click('button[data-bench="thermal"]'); await pg.wait_for_timeout(800)
        for v in ['10', '5', '2.5']:
            await pg.evaluate("(x)=>{const e=document.getElementById('tV');e.value=x;"
                              "e.dispatchEvent(new Event('input',{bubbles:true}));}", v)
            await pg.click('#tSample'); await pg.wait_for_timeout(180)
        await pg.click('#tTaskList button:nth-child(1)'); await pg.wait_for_timeout(300)
        await pg.click('#tCheck'); await pg.wait_for_timeout(400)
        assert 'выполнено' in (await pg.inner_text('#tCheckOut'))
        # нагрев воды → задание 5
        await pg.click('#tMode button[data-mode="heat"]'); await pg.wait_for_timeout(250)
        await pg.click('#tHeatGo'); await pg.wait_for_timeout(300)
        await pg.click('#tTaskList button:nth-child(5)'); await pg.wait_for_timeout(250)
        await pg.click('#tCheck'); await pg.wait_for_timeout(350)
        assert 'выполнено' in (await pg.inner_text('#tCheckOut'))
        print('тепло: нагрев воды — задание 5 выполнено')

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
