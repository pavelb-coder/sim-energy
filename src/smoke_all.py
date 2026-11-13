import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1440,'height':960})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE: '+m.text) if m.type=='error' else None)
        await pg.goto('file:///home/user/sim-energy/dist/lab.html')
        await pg.wait_for_timeout(500)

        # --- накопители ---
        await pg.click('.benchnav button[data-bench="storage"]'); await pg.wait_for_timeout(900)
        print('накопители видны:', await pg.is_visible('#benchStorage'))
        f = await pg.evaluate("()=>{const f=window.__storage.facts();return {soc:+f.soc.toFixed(2),U:+f.volt.toFixed(2),auto:+f.autonomyH.toFixed(2),eff:+f.eff.toFixed(2)};}")
        print('  факты:', f)
        # свинцовый + buck 5 В
        await pg.evaluate("""()=>{
          document.querySelector('#segType [data-type="lead"]').click();
          const d=document.getElementById('sDuty'); d.value=0.42; d.dispatchEvent(new Event('input'));
        }""")
        await pg.wait_for_timeout(400)
        print('  buck:', await pg.evaluate("()=>+window.__storage.facts().buckV.toFixed(2)"), 'В')
        await pg.click('#stSample'); await pg.wait_for_timeout(300)
        await pg.click('#btnDischarge'); await pg.wait_for_timeout(600)
        print('  точек в протоколе:', await pg.evaluate("()=>window.__storage.state().measures.length"),
              '| решения:', await pg.evaluate("()=>JSON.stringify(window.__storage.solved())"))
        await pg.screenshot(path='/tmp/storage.png')

        # --- эффективность ---
        await pg.click('.benchnav button[data-bench="efficiency"]'); await pg.wait_for_timeout(900)
        print('эффективность видна:', await pg.is_visible('#benchEfficiency'))
        base = await pg.evaluate("()=>{const f=window.__eff.facts();return {total:+f.totalKwh.toFixed(2),percent:+f.percent.toFixed(2),allNorm:f.allNorm};}")
        print('  исходно:', base)
        await pg.evaluate("""()=>{
          document.querySelector('#segLamp [data-lamp="led"]').click();
          document.getElementById('senMotion').click();
          document.getElementById('senLight').click();
          document.getElementById('senSched').click();
        }""")
        await pg.wait_for_timeout(500)
        after = await pg.evaluate("()=>{const f=window.__eff.facts();return {total:+f.totalKwh.toFixed(2),percent:+f.percent.toFixed(2),allNorm:f.allNorm,lux:f.lux.map(r=>Math.round(r.lux))};}")
        print('  после LED+датчиков:', after)
        await pg.click('#efSample'); await pg.wait_for_timeout(200)
        await pg.click('#efDay'); await pg.wait_for_timeout(300)
        print('  решения:', await pg.evaluate("()=>JSON.stringify(window.__eff.solved())"))
        await pg.screenshot(path='/tmp/eff.png')

        # --- возврат к первым двум стендам ---
        await pg.click('.benchnav button[data-bench="circuits"]'); await pg.wait_for_timeout(300)
        await pg.click('#btnDemo'); await pg.wait_for_timeout(400)
        print('цепи живы:', await pg.evaluate("()=>window.__lab.world().parts.length"))
        await pg.click('.benchnav button[data-bench="renew"]'); await pg.wait_for_timeout(600)
        print('ВИЭ живы:', await pg.evaluate("()=>+window.__renew.facts().pv.toFixed(1)"), 'Вт')
        print('ОШИБКИ:', errs[:8])
        await b.close()

asyncio.run(main())
