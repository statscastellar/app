const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=__dirname;process.chdir(root);fs.mkdirSync('reports',{recursive:true});
const expected=require('./fixtures/fix-app-sha256.json');
function verifyApp(){
 const base=path.resolve(root,'..'), paths=new Map();
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   if(dir===base&&['.git','tests'].includes(entry.name))continue;
   const full=path.join(dir,entry.name);
   if(entry.isDirectory())walk(full);
   else if(entry.isFile()){const rel=path.relative(base,full).split(path.sep).join('/');paths.set(crypto.createHash('sha256').update(rel).digest('hex'),full);}
 }}
 walk(base);
 return Object.entries(expected).every(([id,h])=>paths.has(id)&&crypto.createHash('sha256').update(fs.readFileSync(paths.get(id))).digest('hex')===h);
}
if(!verifyApp())throw Error('La còpia de l’aplicació no coincideix amb la referència validada d’aquesta branca');
let cli;try{cli=path.join(path.dirname(require.resolve('playwright/package.json')),'cli.js')}catch{console.error('Playwright 1.57.0 absent: executa npm ci dins tests o configura NODE_PATH.');process.exit(2)}
if(require('playwright/package.json').version!=='1.57.0')throw Error('Cal Playwright 1.57.0');
const steps=[['audit',['run-audit.cjs']],['supplemental',['--require','./fixtures/clock.cjs','--test','--test-isolation=none','--test-reporter=spec',...fs.readdirSync(path.join(root,'unit')).filter(x=>x.endsWith('.test.cjs')).sort().map(x=>'unit/'+x)]],['playwright',[cli,'test','-c','playwright.config.cjs']],['investigation',[cli,'test','-c','investigation/playwright.config.cjs']]];
const results=[];
for(const [name,args]of steps){console.log('\nEXECUCIÓ '+name);const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:300000});const log=(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):'');fs.writeFileSync('reports/'+name+'.log',log);console.log(log);results.push({name,exitCode:r.status,signal:r.signal,error:r.error?.message||null})}
const appUnchanged=verifyApp(),audit=JSON.parse(fs.readFileSync('reports/audit.json','utf8')),pw=JSON.parse(fs.readFileSync('reports/playwright.json','utf8'));
const summary={application:'Stats Castellar 1.1.0',sourceCommit:'dc54ab9a749467b246d2f1600d32ec19c52ba200',node:process.version,playwright:require('playwright/package.json').version,appMatchesBranchFixture:appUnchanged,branch:'fix/finalitzacio-partit',audit:{total:audit.total,passed:audit.passed,failed:audit.failed},playwrightStats:pw.stats,steps:results};
fs.writeFileSync('reports/summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));process.exitCode=(!appUnchanged||results.some(x=>x.exitCode!==0))?1:0;
