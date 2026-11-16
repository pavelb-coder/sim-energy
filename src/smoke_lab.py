import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await pg.goto('http://127.0.0.1:8082/', wait_until='networkidle')
        # 1) микросеть: новые работы в списке и подсказка
        await pg.click('button[data-bench="grid"]'); await pg.wait_for_timeout(1200)
        txt = await pg.inner_text('#gTaskList')
        assert 'Облачность и выработка' in txt and 'Оптимальный наклон' in txt, txt
        await pg.click('#gTaskList button:nth-child(7)'); await pg.wait_for_timeout(400)
        await pg.click('#gHint'); await pg.wait_for_timeout(300)
        hint = await pg.inner_text('#gTaskBody')
        assert 'Облачность' in hint
        await pg.screenshot(path='/tmp/n1_grid_task.png')
        # 2) ВИЭ: работа «Наклон панели»
        await pg.click('button[data-bench="renew"]'); await pg.wait_for_timeout(1200)
        t2 = await pg.inner_text('#rTaskList')
        assert 'Наклон панели' in t2 and 'Число лопастей' in t2
        # 3) накопители
        await pg.click('button[data-bench="storage"]'); await pg.wait_for_timeout(1000)
        t3 = await pg.inner_text('#stTaskList')
        assert 'Сравнить два типа АКБ' in t3 and 'Нагрев при заряде' in t3
        # 4) эффективность
        await pg.click('button[data-bench="efficiency"]'); await pg.wait_for_timeout(1000)
        t4 = await pg.inner_text('#efTaskList')
        assert 'Профиль нагрузки' in t4 and 'Датчик движения' in t4
        # 5) водород
        await pg.click('button[data-bench="hydrogen"]'); await pg.wait_for_timeout(1200)
        t5 = await pg.inner_text('#hyTaskList')
        assert 'Сравнить источники' in t5 and 'Минимум разложения' in t5
        await pg.screenshot(path='/tmp/n2_hydrogen.png')
        # 6) цепи
        await pg.click('button[data-bench="circuits"]'); await pg.wait_for_timeout(800)
        await pg.click('button[data-mode="task"]'); await pg.wait_for_timeout(500)
        t6 = await pg.inner_text('#taskList')
        assert 'Параллельное соединение' in t6 and 'Энергия и стоимость' in t6
        # регрессия: палитра «Цепей» не должна дублировать оборудование
        await pg.click('button[data-bench="circuits"]'); await pg.wait_for_timeout(600)
        base = await pg.evaluate("() => document.querySelectorAll('.partitem').length")
        await pg.fill('#q', 'лампа'); await pg.wait_for_timeout(250)
        await pg.fill('#q', ''); await pg.wait_for_timeout(250)
        for _ in range(3):
            await pg.click('.chips button[data-cat="load"]'); await pg.wait_for_timeout(120)
            await pg.click('.chips button[data-cat="all"]'); await pg.wait_for_timeout(120)
        after = await pg.evaluate("() => document.querySelectorAll('.partitem').length")
        assert base == after == 10, (base, after)
        await pg.dblclick('.partitem:has-text("Резистор")'); await pg.wait_for_timeout(400)
        n = await pg.evaluate("() => window.__lab.world().parts.length")
        assert n == 1, ('двойное нажатие добавило ' + str(n) + ' детали')
        print('палитра без дублей, двойное нажатие ставит одну деталь — ок')

        print('все новые работы видны в списках, ошибок:', len(errs), errs[:3] if errs else '')
        await b.close()
asyncio.run(main())
