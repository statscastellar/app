import subprocess, time, urllib.request, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
PORT=8877
BASE=f'http://127.0.0.1:{PORT}'
DRAFT=json.loads((ROOT/'core/fixtures/draft.json').read_text(encoding='utf-8'))

server=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE+'/index.html',timeout=.25).read(20); break
        except Exception: time.sleep(.1)
    else: raise RuntimeError('Servidor no disponible')

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':896,'height':414})
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))

        page.goto(BASE+'/index.html', wait_until='domcontentloaded')
        result=page.evaluate("""async (draft)=>{
          const P=window.StatsPro2;
          if(!P) throw new Error('StatsPro2 no disponible a portada');
          const made=P.createMatchFromDraft(draft,{matchId:'browser-real-001',now:'2026-10-05T12:00:00Z'});
          const engine=new P.MatchEngine(made.state,made.actionLog,[]);
          const adapter=new P.IndexedDBStorageAdapter();
          const storage=new P.Pro2Storage(adapter);
          const rows=await adapter.list('activeMatches');
          for(const r of rows) await adapter.delete('activeMatches',r.matchId);
          await storage.saveActive(engine);
          return {matchId:engine.state.identity.matchId};
        }""", DRAFT)
        assert result['matchId']=='browser-real-001'

        page.goto(BASE+'/Capa7/index.html', wait_until='networkidle')
        page.wait_for_selector('#playerGrid .player-slot')
        assert page.locator('#playerGrid .player-slot').count()==6
        assert page.locator('#actionValue').inner_text()=='RECEPCIÓ'
        print('PASS Capa 7 arrenca amb motor Pro.2 i IndexedDB real')

        page.locator('#playerGrid .player-slot').nth(4).locator('button.r2').click()
        assert page.locator('#actionValue').inner_text()=='COL·LOCACIÓ'
        page.locator('#playerGrid .player-slot').nth(1).locator('button.r2').click()
        assert page.locator('#actionValue').inner_text()=='ATAC'
        page.locator('#playerGrid .player-slot').nth(0).locator('button.r3').click()
        assert page.locator('#scoreHome').inner_text()=='1'
        assert page.locator('#actionValue').inner_text()=='SERVEI'
        print('PASS R→C→A, punt propi, rotació i servei')

        for i in range(5):
            assert page.locator('#playerGrid .player-slot').nth(i).locator('button.r1').is_disabled()
        assert not page.locator('#playerGrid .player-slot').nth(5).locator('button.r1').is_disabled()
        print('PASS servei propi: només zona 1 valorable')

        page.locator('#playerGrid .player-slot').nth(5).locator('button.r0').click()
        assert page.locator('#actionValue').inner_text()=='RECEPCIÓ'
        page.locator('#playerGrid .player-slot').nth(4).locator('button.r0').click()
        assert not page.locator('#sosBtn').is_disabled()
        rival_with_provisional=int(page.locator('#scoreAway').inner_text())
        page.locator('#sosBtn').click()
        assert page.locator('#actionValue').inner_text()=='SALVADA'
        assert int(page.locator('#scoreAway').inner_text())==rival_with_provisional-1
        for i in range(6):
            assert page.locator('#playerGrid .player-slot').nth(i).locator('button.r0').is_disabled()
        page.locator('#playerGrid .player-slot').nth(0).locator('button.r3').click()
        assert page.locator('#actionValue').inner_text()=='COL·LOCACIÓ'
        print('PASS SOS/Salvada 1–3 directe, sense modal')

        before=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        page.locator('#positionsBtn').click()
        a=page.locator('#playerGrid .player-slot').nth(0); b=page.locator('#playerGrid .player-slot').nth(1)
        ab=a.bounding_box(); bb=b.bounding_box()
        page.mouse.move(ab['x']+ab['width']/2,ab['y']+ab['height']/2)
        page.mouse.down(); page.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2,steps=10); page.mouse.up()
        mid=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        assert mid[0]==before[1] and mid[1]==before[0]
        page.locator('#positionsBtn').click()
        print('PASS Posicions: drag-and-drop real + confirmació')

        score=(page.locator('#scoreHome').inner_text(),page.locator('#scoreAway').inner_text())
        phase=page.locator('#actionValue').inner_text()
        page.reload(wait_until='networkidle'); page.wait_for_selector('#playerGrid .player-slot')
        assert (page.locator('#scoreHome').inner_text(),page.locator('#scoreAway').inner_text())==score
        assert page.locator('#actionValue').inner_text()==phase
        after_reload=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        assert after_reload==mid
        print('PASS reload + IndexedDB conserva estat complet')

        assert not page.locator('#undoBtn').is_disabled()
        page.locator('#undoBtn').click()
        undone=[page.locator('#playerGrid .player-slot').nth(i).locator('.player-id strong').inner_text() for i in range(6)]
        assert undone==before
        print('PASS Desfer després de recàrrega')

        assert not errors, errors
        print('RESULTAT FINAL: PASS — CAPA 7 REAL + MOTOR PRO.2 + INDEXEDDB')
        browser.close()
finally:
    server.terminate()
    try: server.wait(timeout=2)
    except Exception: server.kill()
