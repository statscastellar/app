'use strict';
const { ANNA_TYPES } = require('./stats-engine');

const LABELS=Object.freeze({SERVEI:'Servei',RECEPCIO:'Recepció',DEFENSA:'Defensa',COLLOCACIO:'Col·locació',ATAC:'Atac',BLOQUEIG:'Bloqueig',SALVADA:'Salvada'});
const TREND_THRESHOLD=0.03;
const round=(n,d=3)=>n==null?null:Math.round(Number(n)*10**d)/10**d;
function pct0(bucket){return bucket?.percentages?.[0]??null}
function pct3(bucket){return bucket?.percentages?.[3]??null}
function trendLabel(delta){if(delta==null)return 'Sense dades';if(delta>TREND_THRESHOLD)return 'Millora';if(delta<-TREND_THRESHOLD)return 'Baixa';return 'Estable';}
function scoreText(report){if(report?.metadata?.legacyResult)return String(report.metadata.legacyResult).replace('–','-');let t=0,r=0;for(const s of report?.result?.sets||[]){if(s.winner==='team')t++;else if(s.winner==='rival')r++;}return `${t}-${r}`;}
function setEfficiencyRows(report){return Object.keys(report?.stats?.bySet||{}).map(Number).sort((a,b)=>a-b).map(n=>({set:n,actions:report.stats.bySet[n]?.teamAnnaTotal?.actions||0,efficiency:report.stats.bySet[n]?.teamAnnaTotal?.efficiency??null,pct0:pct0(report.stats.bySet[n]?.teamAnnaTotal),pct3:pct3(report.stats.bySet[n]?.teamAnnaTotal)}));}
function playerMatchInsight(p){
  const foundations=ANNA_TYPES.map(t=>({type:t,label:LABELS[t]||t,actions:p?.anna?.[t]?.actions||0,efficiency:p?.anna?.[t]?.efficiency??null,pct0:pct0(p?.anna?.[t]),pct3:pct3(p?.anna?.[t])}));
  const withData=foundations.filter(x=>x.actions>0&&x.efficiency!=null);
  const strength=withData.length?[...withData].sort((a,b)=>b.efficiency-a.efficiency||b.actions-a.actions)[0]:null;
  const priority=withData.length?[...withData].sort((a,b)=>a.efficiency-b.efficiency||b.actions-a.actions)[0]:null;
  return {playerId:p.playerId,number:p.number??'',name:p.name||'',actions:p.annaTotal?.actions||0,efficiency:p.annaTotal?.efficiency??null,impact:p.impact??null,pct0:pct0(p.annaTotal),pct3:pct3(p.annaTotal),strength,priority,sampleSmall:(p.annaTotal?.actions||0)<5,foundations};
}
function buildMatchAnalytics(report){
  const players=(report?.stats?.players||[]).map(playerMatchInsight);
  const sets=setEfficiencyRows(report);
  const teamFoundations=ANNA_TYPES.map(t=>({type:t,label:LABELS[t]||t,actions:report?.stats?.teamAnna?.[t]?.actions||0,efficiency:report?.stats?.teamAnna?.[t]?.efficiency??null,pct0:pct0(report?.stats?.teamAnna?.[t]),pct3:pct3(report?.stats?.teamAnna?.[t])}));
  const bestSet=sets.filter(x=>x.efficiency!=null).sort((a,b)=>b.efficiency-a.efficiency)[0]||null;
  const bestEfficiency=players.filter(x=>x.actions>0&&x.efficiency!=null).sort((a,b)=>b.efficiency-a.efficiency||b.actions-a.actions)[0]||null;
  const mostImpact=players.filter(x=>x.actions>0&&x.impact!=null).sort((a,b)=>b.impact-a.impact)[0]||null;
  const strengths=[...teamFoundations].filter(x=>x.actions>0).sort((a,b)=>(b.efficiency??-1)-(a.efficiency??-1)).slice(0,3);
  const priorities=[...teamFoundations].filter(x=>x.actions>0).sort((a,b)=>(a.efficiency??2)-(b.efficiency??2)).slice(0,2);
  const ranking=[...players].sort((a,b)=>(b.efficiency??-1)-(a.efficiency??-1)||(b.impact??-1)-(a.impact??-1)||(b.actions??0)-(a.actions??0));
  return {
    matchId:report?.matchId||null,opponent:report?.metadata?.opponent||'Rival',date:report?.metadata?.date||'',score:scoreText(report),
    actions:report?.stats?.teamAnnaTotal?.actions||0,efficiency:report?.stats?.teamAnnaTotal?.efficiency??null,pct0:pct0(report?.stats?.teamAnnaTotal),pct3:pct3(report?.stats?.teamAnnaTotal),
    sets,bestSet,bestEfficiency,mostImpact,teamFoundations,players,ranking,strengths,priorities,
    saves:report?.stats?.teamSaves||{counts:{1:0,2:0,3:0},total:0},blocks:report?.stats?.teamBlocks||{counts:{0:0,1:0,2:0},total:0}
  };
}
function mergeBucket(target,b){if(!b)return;for(const k of [0,1,2,3])target.counts[k]+=Number(b.counts?.[k]||0);}
function finalizeBucket(b){b.actions=[0,1,2,3].reduce((s,k)=>s+b.counts[k],0);b.annaPoints=b.counts[1]*5+b.counts[2]*8+b.counts[3]*10;b.efficiency=b.actions?b.annaPoints/(b.actions*10):null;b.percentages={};for(const k of [0,1,2,3])b.percentages[k]=b.actions?b.counts[k]/b.actions:null;return b;}
function newBucket(){return {counts:{0:0,1:0,2:0,3:0},actions:0,annaPoints:0,efficiency:null,percentages:{0:null,1:null,2:null,3:null}};}
function canonicalTeamId(id){id=String(id||'');return id==='infantil-a'||id==='castellar-infantil-a'?'castellar-infantil-a':id;}
function canonicalPlayerId(p,teamId){const id=String(p?.playerId||'');if(canonicalTeamId(teamId)==='castellar-infantil-a'){const m=id.match(/^(?:ia-|p)(\d+)$/);if(m)return `p${Number(m[1])}`;}return id;}
function reportDateKey(r,i){const d=r?.metadata?.date||'';return `${d}|${String(i).padStart(5,'0')}`;}
function buildHistoryAnalytics(reports,options={}){
  let arr=(reports||[]).filter(Boolean);
  const teamId=options.teamId?canonicalTeamId(options.teamId):null;if(teamId)arr=arr.filter(r=>canonicalTeamId(r?.metadata?.teamId)===teamId);
  arr=arr.map((r,i)=>({r,i})).sort((a,b)=>reportDateKey(a.r,a.i).localeCompare(reportDateKey(b.r,b.i))).map(x=>x.r);
  const perMatch=arr.map(r=>buildMatchAnalytics(r));
  const playerMap={};
  const teamFoundations=Object.fromEntries(ANNA_TYPES.map(t=>[t,newBucket()]));
  for(const report of arr){
    const match=buildMatchAnalytics(report);
    for(const t of ANNA_TYPES)mergeBucket(teamFoundations[t],report?.stats?.teamAnna?.[t]);
    for(const p of report?.stats?.players||[]){
      const canonicalId=canonicalPlayerId(p,report?.metadata?.teamId),key=canonicalId||String(p.playerId||'');
      const x=playerMap[key]||(playerMap[key]={playerId:canonicalId||p.playerId,number:p.number??'',name:p.name||'',matches:[],foundations:Object.fromEntries(ANNA_TYPES.map(t=>[t,newBucket()])),total:newBucket(),saves:{counts:{1:0,2:0,3:0},total:0},blocks:{counts:{0:0,1:0,2:0},total:0}});
      x.number=p.number??x.number;x.name=p.name||x.name;
      const pi=match.players.find(y=>String(y.playerId)===String(p.playerId))||playerMatchInsight(p);
      x.matches.push({matchId:report.matchId,date:report.metadata?.date||'',opponent:report.metadata?.opponent||'Rival',actions:pi.actions,efficiency:pi.efficiency,impact:pi.impact,pct0:pi.pct0,pct3:pi.pct3,foundations:pi.foundations});
      for(const t of ANNA_TYPES)mergeBucket(x.foundations[t],p?.anna?.[t]);
      mergeBucket(x.total,p?.annaTotal);
      for(const k of [1,2,3])x.saves.counts[k]+=Number(p?.saves?.counts?.[k]||0);x.saves.total+=Number(p?.saves?.total||0);
      for(const k of [0,1,2])x.blocks.counts[k]+=Number(p?.blocks?.counts?.[k]||0);x.blocks.total+=Number(p?.blocks?.total||0);
    }
  }
  for(const t of ANNA_TYPES)finalizeBucket(teamFoundations[t]);
  const players=Object.values(playerMap).map(x=>{
    for(const t of ANNA_TYPES)finalizeBucket(x.foundations[t]);finalizeBucket(x.total);
    const valid=x.matches.filter(m=>m.efficiency!=null&&m.actions>0);const first=valid[0]||null,last=valid[valid.length-1]||null;const delta=first&&last&&valid.length>1?last.efficiency-first.efficiency:null;
    const foundationEvolution=ANNA_TYPES.map(t=>{const rows=x.matches.map(m=>{const f=m.foundations.find(z=>z.type===t);return {date:m.date,opponent:m.opponent,actions:f?.actions||0,efficiency:f?.efficiency??null,pct0:f?.pct0??null,pct3:f?.pct3??null};});const vv=rows.filter(r=>r.efficiency!=null&&r.actions>0);const a=vv[0]||null,b=vv[vv.length-1]||null;const d=a&&b&&vv.length>1?b.efficiency-a.efficiency:null;const e0=a&&b&&vv.length>1?(a.pct0??0)-(b.pct0??0):null;return {type:t,label:LABELS[t]||t,rows,delta:d,errorReduction:e0,trend:trendLabel(d)};});
    return {...x,delta,trend:trendLabel(delta),pct0:pct0(x.total),pct3:pct3(x.total),foundationEvolution};
  }).sort((a,b)=>(a.number??999)-(b.number??999));
  const teamFoundationEvolution=ANNA_TYPES.map(t=>{const rows=perMatch.map((m,idx)=>{const f=m.teamFoundations.find(z=>z.type===t);return {matchId:m.matchId,date:m.date,opponent:m.opponent,actions:f?.actions||0,efficiency:f?.efficiency??null,pct0:f?.pct0??null,pct3:f?.pct3??null,index:idx+1};});const vv=rows.filter(r=>r.actions>0&&r.efficiency!=null),a=vv[0]||null,b=vv[vv.length-1]||null;const d=a&&b&&vv.length>1?b.efficiency-a.efficiency:null;return {type:t,label:LABELS[t]||t,rows,delta:d,errorReduction:a&&b&&vv.length>1?(a.pct0??0)-(b.pct0??0):null,trend:trendLabel(d)};});
  const total=newBucket();for(const t of ANNA_TYPES)mergeBucket(total,teamFoundations[t]);finalizeBucket(total);
  return {teamId:teamId||arr[0]?.metadata?.teamId||null,teamName:arr[0]?.metadata?.teamName||'',matches:arr.length,perMatch,players,teamFoundations:Object.entries(teamFoundations).map(([type,b])=>({type,label:LABELS[type]||type,...b})),teamTotal:total,teamFoundationEvolution};
}
module.exports={LABELS,TREND_THRESHOLD,trendLabel,scoreText,buildMatchAnalytics,buildHistoryAnalytics,canonicalTeamId,canonicalPlayerId};
