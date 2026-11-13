import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await pg.goto('file:///home/user/sim-energy/dist/lab.html')
        await pg.wait_for_timeout(500)

        # 1) перетаскивание клемм мышью — собираем цепь руками
        await pg.click('#btnClear')
        await pg.click('.partitem:has-text("Батарея")')
        await pg.click('.partitem:has-text("Ключ")')
        await pg.click('.partitem:has-text("Лампа")')
        await pg.wait_for_timeout(300)
        print('parts:', await pg.evaluate("()=>window.__lab.world().parts.length"))

        # соединяем клеммы кликами: source:1 -> key:0, key:1 -> lamp:0, lamp:1 -> source:0
        ids = await pg.evaluate("()=>{const w=window.__lab.world();const o={};w.parts.forEach(p=>o[p.type]=p.id);return o;}")
        async def click_term(pid, idx):
            sel = f'.term[data-pid="{pid}"][data-idx="{idx}"]'
            await pg.click(sel, force=True)
            await pg.wait_for_timeout(120)
        await click_term(ids['source'],1); await click_term(ids['key'],0)
        await click_term(ids['key'],1);   await click_term(ids['lamp'],0)
        await click_term(ids['lamp'],1);  await click_term(ids['source'],0)
        print('wires:', await pg.evaluate("()=>window.__lab.world().wires.length"))

        # 2) инспектор: замкнуть ключ через кнопку
        await pg.click(f'.part[data-id="{ids["key"]}"]')   # одиночный клик по ключу замыкает его
        await pg.wait_for_timeout(1800)
        f = await pg.evaluate("""()=>{const w=window.__lab.world(),L=window.__lab.Lab;const f=L.facts(w,L.analyze(w));return {I:f.sourceCurrent,U:f.loadVoltage,bright:f.lampBright};}""")
        print('after closing key:', f)

        # 3) прогноз в задании
        await pg.click('.modes button[data-mode="task"]')
        await pg.wait_for_timeout(300)
        await pg.fill('#guessInput','0.22')
        await pg.click('#btnGuess')
        await pg.wait_for_timeout(300)
        print('guess msg:', await pg.inner_text('#guessOut'))

        # 4) снять показания + CSV
        await pg.click('#btnMeasure')
        await pg.wait_for_timeout(200)
        await pg.click('.tabs button[data-tab="meas"]')
        await pg.wait_for_timeout(200)
        await pg.screenshot(path='shot3.png')

        # 5) замыкание: без нагрузки
        await pg.click('#btnClear')
        await pg.click('.partitem:has-text("Батарея")')
        await pg.click('.partitem:has-text("Предохранитель")')
        await pg.click('.partitem:has-text("Ключ")')
        ids2 = await pg.evaluate("()=>{const w=window.__lab.world();const o={};w.parts.forEach(p=>o[p.type]=p.id);return o;}")
        await click_term(ids2['source'],1); await click_term(ids2['fuse'],0)
        await click_term(ids2['fuse'],1); await click_term(ids2['key'],0)
        await click_term(ids2['key'],1); await click_term(ids2['source'],0)
        await pg.click(f'.part[data-id="{ids2["key"]}"]'); await pg.wait_for_timeout(150)
        await pg.click('#btnKey')
        await pg.wait_for_timeout(1500)
        blown = await pg.evaluate("()=>{const w=window.__lab.world();return {blown:!!(w.parts.find(p=>p.type==='fuse')||{}).props.blown, sc:w.counters.shortCircuit};}")
        print('short circuit test:', blown)
        await pg.screenshot(path='shot4.png')
        print('ERRORS:', errs[:10])
        await b.close()

asyncio.run(main())
