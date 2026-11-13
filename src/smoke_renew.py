import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1440,'height':980})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/user/sim-energy/dist/lab.html'); await pg.wait_for_timeout(400)
        await pg.click('.benchnav button[data-bench="renew"]'); await pg.wait_for_timeout(700)
        # наклонить панель, включить насос, прогнать сутки с PWM и MPPT
        await pg.evaluate("""()=>{
          const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'));};
          set('sTilt',34); set('sAz',25); set('sWind',8);
          document.getElementById('loadPump').click();
          document.querySelector('#segCtrl [data-ctrl="pwm"]').click();
        }""")
        await pg.wait_for_timeout(400)
        await pg.click('#btnDay'); await pg.wait_for_timeout(200)
        await pg.evaluate("()=>document.querySelector('#segCtrl [data-ctrl=\"mppt\"]').click()")
        await pg.wait_for_timeout(200)
        await pg.click('#btnDay'); await pg.wait_for_timeout(300)
        print('решения:', await pg.evaluate("()=>JSON.stringify(window.__renew.solved())"))
        print('прогоны:', await pg.evaluate("()=>window.__renew.state().measures.filter(m=>m.kind==='day').map(m=>[m.controller,Math.round(m.gen)])"))
        await pg.screenshot(path='/tmp/renew4.png')
        # зима
        await pg.evaluate("()=>{const e=document.getElementById('sDay');e.value=355;e.dispatchEvent(new Event('input'));}")
        await pg.wait_for_timeout(600)
        await pg.screenshot(path='/tmp/renew5.png')
        print('ошибки:', errs[:5])
        await b.close()
asyncio.run(main())
