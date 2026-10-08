import os, subprocess, time, urllib.request, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PORT=8877
server=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(40):
        try:
            urllib.request.urlopen(f'http://127.0.0.1:{PORT}/ui/capa7-pro2/index.html',timeout=.2).read(10);break
        except Exception: time.sleep(.1)
    else: raise RuntimeError('Servidor no disponible')

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':896,'height':414})
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{PORT}/ui/capa7-pro2/index.html',wait_until='networkidle')
        page.wait_for_selector('#playerGrid .player-slot')
        assert page.locator('#playerGrid .player-slot').count()==6
        assert page.locator('#actionValue').inner_text()=='RECEPCIÓ'
        print('PASS Capa 7 arrenca amb motor Pro.2')

        # R2 -> C2 -> A3, fent clic sobre els botons reals de quadrants.
        page.locator('#playerGrid .player-slot').nth(4).locator('button.r2').click()  # zona 6
        assert page.locator('#actionValue').inner_text()=='COL·LOCACIÓ'
        page.locator('#playerGrid .player-slot').nth(1).locator('button.r2').click()  # zona 3
        assert page.locator('#actionValue').inner_text()=='ATAC'
        page.locator('#playerGrid .player-slot').nth(0).locator('button.r3').click()  # zona 4
        assert page.locator('#scoreHome').inner_text()=='1'
        assert page.locator('#actionValue').inner_text()=='SERVEI'
        print('PASS seqüència R→C→A i marcador/servei')

        # Durant servei només zona 1 activa.
        for i in range(5):
            assert page.locator('#playerGrid .player-slot').nth(i).locator('button.r1').is_disabled()
        assert not page.locator('#playerGrid .player-slot').nth(5).locator('button.r1').is_disabled()
        print('PASS servei: només zona 1 valorable')

        # Fem servei 0 perquè torni recepció rival; després R0 + SOS + salvada 3.
        page.locator('#playerGrid .player-slot').nth(5).locator('button.r0').click()
        assert page.locator('#actionValue').inner_text()=='RECEPCIÓ'
        page.locator('#playerGrid .player-slot').nth(4).locator('button.r0').click()
        assert not page.locator('#sosBtn').is_disabled()
        rival_before=int(page.locator('#scoreAway').inner_text())
        page.locator('#sosBtn').click()
        assert page.locator('#actionValue').inner_text()=='SALVADA'
        assert int(page.locator('#scoreAway').inner_text())==rival_before-1
        assert page.locator('#playerGrid .player-slot').nth(0).locator('button.r0').is_disabled()
        page.locator('#playerGrid .player-slot').nth(0).locator('button.r3').click()
        assert page.locator('#actionValue').inner_text()=='COL·LOCACIÓ'
        print('PASS SOS/Salvada directe sobre quadrants, sense modal')

        # Posicions: activa mode i intercanvi per arrossegament real entre 1r i 2n slot.
        before=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        page.locator('#positionsBtn').click()
        a=page.locator('#playerGrid .player-slot').nth(0); b=page.locator('#playerGrid .player-slot').nth(1)
        ab=a.bounding_box(); bb=b.bounding_box()
        page.mouse.move(ab['x']+ab['width']/2,ab['y']+ab['height']/2)
        page.mouse.down(); page.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2,steps=8); page.mouse.up()
        mid=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        assert mid[0]==before[1] and mid[1]==before[0]
        page.locator('#positionsBtn').click()
        after=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        assert after==mid
        print('PASS Posicions per arrossegament sobre Capa 7 real')

        # Persistència IndexedDB: recarrega i conserva score i posicions.
        score=(page.locator('#scoreHome').inner_text(),page.locator('#scoreAway').inner_text())
        page.reload(wait_until='networkidle'); page.wait_for_selector('#playerGrid .player-slot')
        score2=(page.locator('#scoreHome').inner_text(),page.locator('#scoreAway').inner_text())
        after2=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        assert score2==score and after2==after
        print('PASS IndexedDB real després de recarregar')

        # Desfer continua disponible després de recàrrega.
        assert not page.locator('#undoBtn').is_disabled()
        page.locator('#undoBtn').click()
        undone=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        assert undone==before
        print('PASS Desfer persisteix després de recarregar')

        assert not errors, errors
        print('RESULTAT FINAL: PASS — CAPA 7 + MOTOR PRO.2 + INDEXEDDB')
        browser.close()
finally:
    server.terminate()
    try: server.wait(timeout=2)
    except: server.kill()
