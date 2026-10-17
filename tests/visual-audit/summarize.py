"""Summarize observations without changing any baseline. Requires Pillow."""
import json
from pathlib import Path
from PIL import Image, ImageChops
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/visual-audit'
def diff(a,b):
 a,b=Image.open(a).convert('RGB'),Image.open(b).convert('RGB')
 if a.size!=b.size:return {'sizeMismatch':[a.size,b.size]}
 d=ImageChops.difference(a,b)
 # Count pixels with any unequal channel, including antialiasing (stricter than Playwright).
 red,green,blue=d.split(); maximum=ImageChops.lighter(ImageChops.lighter(red,green),blue)
 n=a.width*a.height-maximum.histogram()[0]; bbox=maximum.getbbox()
 return {'pixels':n,'bbox':bbox,'maxChannelDelta':max(x[1] for x in d.getextrema())}
rows=[]
for file in sorted(OUT.glob('*-chromium/*.json')):
 row=json.loads(file.read_text()); m=row['measurements']; controls=m['controls']
 assert all('confirmedClip' in c for c in controls), f'Stale observation: {file}'
 row['baselineDiffs']=[diff(ROOT/'e2e/baselines'/row['profile']/(row['screen']+'.png'),file.with_name(row['screen']+f'-{i}.png')) for i in range(3)]
 row['frameDiffs']=[diff(file.with_name(row['screen']+'-0.png'),file.with_name(row['screen']+f'-{i}.png')) for i in [1,2]]
 row['findings']={
  'clipped':[c for c in controls if c.get('confirmedClip',c['clipped'])],
  'textBoundsCandidates':[c for c in controls if c['clipped']],
  'outsideHorizontal':[c for c in controls if c['horizontalOutside'] and not c['scrollContainers']],
  'covered':[c for c in controls if c['coveredBy']],
  'unnamed':[c for c in controls if not c['name']],
  'notKeyboardFocusable':[c for c in controls if c['tabIndex']<0 and not c['disabled']],
 }
 rows.append(row)
(OUT/'observations.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False)+'\n')
for r in rows:
 print(r['profile'],r['screen'],'diff',r['baselineDiffs'][0], 'unstable',r['frameDiffs'], 'overflow',r['measurements']['document']['horizontalOverflow'],{k:len(v) for k,v in r['findings'].items()})
assert len(rows)==24, f'Expected 24 complete observations, found {len(rows)}'
