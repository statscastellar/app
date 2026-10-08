(()=>{'use strict';
const HISTORIC_INFANTIL_A='2f356fc38f5bf2d3.png';
const PROFILES={
  'infantil-a-validated':{profileId:'infantil-a-validated',ageBand:'infantil',sex:'female',label:'Infantil Femení A · fons històric validat',backgroundKey:HISTORIC_INFANTIL_A,assetStatus:'validated-current',overlayMode:'none'},
  'infantil-female':{profileId:'infantil-female',ageBand:'infantil',sex:'female',label:'Infantil femení · 12–14',backgroundKey:'bg-infantil-female.png',assetStatus:'validated-composition',overlayMode:'none'},
  'infantil-male':{profileId:'infantil-male',ageBand:'infantil',sex:'male',label:'Infantil masculí · 12–14',backgroundKey:'bg-infantil-male.png',assetStatus:'validated-composition',overlayMode:'none'},
  'teen-female':{profileId:'teen-female',ageBand:'teen',sex:'female',label:'Cadet/Juvenil femení · 14–18',backgroundKey:'bg-teen-female.png',assetStatus:'validated-composition',overlayMode:'none'},
  'teen-male':{profileId:'teen-male',ageBand:'teen',sex:'male',label:'Cadet/Juvenil masculí · 14–18',backgroundKey:'bg-teen-male.png',assetStatus:'validated-composition',overlayMode:'none'},
  'adult-female':{profileId:'adult-female',ageBand:'adult',sex:'female',label:'Júnior/Sènior femení · 18+',backgroundKey:'bg-adult-female.png',assetStatus:'validated-composition',overlayMode:'none'},
  'adult-male':{profileId:'adult-male',ageBand:'adult',sex:'male',label:'Júnior/Sènior masculí · 18+',backgroundKey:'bg-adult-male.png',assetStatus:'validated-composition',overlayMode:'none'},
  'master-mixed':{profileId:'master-mixed',ageBand:'master',sex:'mixed',label:'Màster mixt · 35+',backgroundKey:'bg-master-mixed.png',assetStatus:'validated-composition',overlayMode:'none'}
};
const codeOf=team=>String(team?.category?.code||team?.category||'').trim().toUpperCase();
function bandFor(team){
  const code=codeOf(team);
  if(code==='MASTER'||code==='MÀSTER')return 'master';
  if(code==='INFANTIL')return 'infantil';
  if(code==='CADET'||code==='JUVENIL')return 'teen';
  if(code==='JUNIOR'||code==='JÚNIOR'||code==='SENIOR'||code==='SÈNIOR')return 'adult';
  return 'adult';
}
function normalizeSex(team){
  if(bandFor(team)==='master')return 'mixed';
  return String(team?.sex||'female').toLowerCase()==='male'?'male':'female';
}
function resolve(team){
  const teamId=String(team?.teamId||'').trim();
  if(teamId==='castellar-infantil-a')return {...PROFILES['infantil-a-validated'],customBackgroundAssetId:null,playersOnCourt:6,format:'volleyball-6x6'};
  const band=bandFor(team),sex=normalizeSex(team);
  const key=band==='master'?'master-mixed':`${band}-${sex}`;
  const p=PROFILES[key]||PROFILES['adult-female'];
  const customBackgroundAssetId=team?.visualProfile?.customBackgroundAssetId||null;
  return {...p,backgroundKey:customBackgroundAssetId||p.backgroundKey,customBackgroundAssetId,playersOnCourt:6,format:'volleyball-6x6'};
}
window.Pro2VisualProfiles={PROFILES,resolve,bandFor,normalizeSex,HISTORIC_INFANTIL_A};
})();
