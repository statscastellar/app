const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const dir=__dirname,manifest=require('./fixtures/audit-manifest.json');
if(manifest.length!==39||!manifest.some(x=>x.file==='tactical-locks-055.test.js'))throw Error('Inventari incomplet: calen 39 fitxers incloent tactical-locks-055');
fs.mkdirSync(path.join(dir,'reports/audit'),{recursive:true});
const results=[];
for(const {file} of manifest){const r=spawnSync(process.execPath,['--require',path.join(dir,'fixtures/audit-clock.cjs'),path.join(dir,'audit',file)],{cwd:dir,encoding:'utf8',timeout:30000});fs.writeFileSync(path.join(dir,'reports/audit',file+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):''));results.push({file,status:r.status,signal:r.signal,passed:r.status===0});console.log((r.status===0?'PASS':'FAIL')+' '+file);}
const report={total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results};fs.writeFileSync(path.join(dir,'reports/audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));process.exitCode=report.failed?1:0;
