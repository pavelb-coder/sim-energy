import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True)
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/user/sim-energy/dist/lab.html')
        await pg.wait_for_timeout(400)

        # --- режим «Проект»: демо-цепь, замыкание, 3 точки с реостатом ---
        await pg.click('#btnDemo')
        await pg.wait_for_timeout(300)
        await pg.click('.part[data-id]')  # выбрать первую деталь
        await pg.evaluate("()=>{const w=window.__lab.world();w.parts.find(p=>p.type==='key').props.closed=true;}")
        await pg.click('.modes button[data-mode="project"]')
        await pg.wait_for_timeout(1500)
        for i in range(3):
            await pg.click('#btnMeasure2')
            await pg.wait_for_timeout(150)
        await pg.screenshot(path='shot5.png')

        # CSV
        await pg.click('.tabs button[data-tab="meas"]')
        async with pg.expect_download() as d:
            await pg.click('#btnCsv')
        dl = await d.value
        path = await dl.path()
        print('CSV:', dl.suggested_filename, open(path, encoding='utf-8-sig').read().replace('\r\n',' | ')[:220])

        # печать протокола доступна
        print('print btn:', await pg.is_visible('#btnPrint'))

        # --- задание «две лампы последовательно» ---
        await pg.click('.modes button[data-mode="task"]')
        await pg.wait_for_timeout(200)
        await pg.click('.tasklist button[data-i="5"]')
        await pg.wait_for_timeout(200)
        await pg.click('#btnClear')
        await pg.wait_for_timeout(200)
        await pg.click('.partitem:has-text("Батарея")')
        await pg.click('.partitem:has-text("Лампа")')
        await pg.click('.partitem:has-text("Лампа")')
        ids = await pg.evaluate("()=>{const w=window.__lab.world();return w.parts.map(p=>[p.id,p.type]);}")
        lamps=[i for i,t in ids if t=='lamp']; src=[i for i,t in ids if t=='source'][0]
        async def ct(pid, idx):
            await pg.click(f'.term[data-pid="{pid}"][data-idx="{idx}"]', force=True)
            await pg.wait_for_timeout(90)
        await ct(src,1); await ct(lamps[0],0)
        await ct(lamps[0],1); await ct(lamps[1],0)
        await ct(lamps[1],1); await ct(src,0)
        await pg.wait_for_timeout(2500)
        print('lamps task solved:', await pg.evaluate("()=>JSON.stringify(window.__lab.solved())"))
        await pg.screenshot(path='shot6.png')
        print('ERRORS:', errs[:8])
        await b.close()

asyncio.run(main())
