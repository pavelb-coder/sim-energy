#!/usr/bin/env python3
"""Локальная сборка: src/app.dev.html + src/engine.js -> ../dist/lab.html"""
import pathlib, sys
here = pathlib.Path(__file__).parent
app = (here / 'app.dev.html').read_text(encoding='utf-8')
eng = (here / 'engine.js').read_text(encoding='utf-8')
if '/*__ENGINE__*/' not in app:
    sys.exit('нет метки /*__ENGINE__*/ в app.dev.html')
out = app.replace('/*__ENGINE__*/', eng)
target = here.parent / 'dist' / 'lab.html'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(out, encoding='utf-8')
print(f'{target} — {len(out.encode("utf-8"))/1024:.0f} КБ')
