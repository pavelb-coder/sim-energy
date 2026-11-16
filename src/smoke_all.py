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

        # --- регресс-проверка: нет дублей id и индикаторы АКБ обновляются ---
        dups = await pg.evaluate("""()=>{
          const m={}; document.querySelectorAll('[id]').forEach(e=>{m[e.id]=(m[e.id]||0)+1;});
          return Object.entries(m).filter(([k,v])=>v>1);
        }""")
        print('дубликаты id:', dups or 'нет')
        batt = await pg.evaluate("""async()=>{
          const st=window.__renew.state();
          const el=()=>document.querySelector('rect#rBattFill');
          st.soc=1; await new Promise(r=>setTimeout(r,350));
          const full=[el().getAttribute('width'), el().getAttribute('fill')];
          st.soc=0.05; await new Promise(r=>setTimeout(r,350));
          const low=[el().getAttribute('width'), el().getAttribute('fill')];
          st.soc=0.5; await new Promise(r=>setTimeout(r,200));
          return {full, low, hue:full[1]!==low[1] && Number(full[0])>Number(low[0])};
        }""")
        print('индикатор АКБ ВИЭ:', batt)
        if dups or not batt['hue']:
            errs.append('АКБ/иконки: индикатор не обновляется или есть дубли id')
        # --- сцены не обрезаются на невысоких окнах (ноутбук 1366x600 и т.п.) ---
        for vw, vh in [(1366, 600), (1280, 720), (1024, 768), (1600, 760)]:
            await pg.set_viewport_size({'width': vw, 'height': vh})
            for bench, key in [('renew', 'rBatt'), ('storage', 'gCell'), ('efficiency', 'roomLab')]:
                await pg.click(f'.benchnav button[data-bench="{bench}"]')
                await pg.wait_for_timeout(450)
                r = await pg.evaluate("""([bench,key])=>{
                  const root=document.getElementById('bench'+bench[0].toUpperCase()+bench.slice(1));
                  const svg=root.querySelector('svg'), b=svg.getBoundingClientRect();
                  const g=document.getElementById(key).getBoundingClientRect();
                  return {insideBot: g.bottom<=b.bottom+2, insideTop: g.top>=b.top-2,
                          inView: g.top>=0 && g.bottom<=innerHeight+2, h:Math.round(b.height)};
                }""", [bench, key])
                if not (r['insideBot'] and r['insideTop']):
                    errs.append(f'{bench}: сцена обрезает {key} при {vw}x{vh} (h={r["h"]})')
                    print(f'  ! {bench} {key} обрезан при {vw}x{vh}', r)
                if not r['inView']:
                    errs.append(f'{bench}: {key} вне экрана при {vw}x{vh}')
        print('проверка обрезки сцен на 4 размерах окна: пройдена' if not errs else 'есть проблемы с обрезкой')
        await pg.set_viewport_size({'width': 1440, 'height': 900})
        print('ОШИБКИ:', errs[:8])
        if errs:
            raise SystemExit(1)
        await b.close()

asyncio.run(main())
