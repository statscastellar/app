(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.StatsPro2Tactical=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ZONES=['1','2','3','4','5','6'];
const VISUAL_ZONES=['4','3','2','5','6','1'];
const FRONT_ZONES=new Set(['2','3','4']);
function clone(x){return JSON.parse(JSON.stringify(x||{}));}
function activeIds(court){return new Set(Object.values(court||{}).filter(Boolean));}
function regulatoryZoneOf(court,playerId){return ZONES.find(z=>court?.[z]===playerId)||null;}
function sanitizeLocks(locks,court){
  const out={}, used=new Set(), active=activeIds(court);
  for(const [playerId,zone] of Object.entries(locks||{})){
    const z=String(zone);
    if(!active.has(playerId)||!ZONES.includes(z)||used.has(z)) continue;
    out[playerId]=z; used.add(z);
  }
  return out;
}
function deriveBaseVisual(court,locks){
  const visual={}, placed=new Set();
  const clean=sanitizeLocks(locks,court);
  for(const [playerId,zone] of Object.entries(clean)){visual[zone]=playerId;placed.add(playerId);}
  for(const zone of VISUAL_ZONES){
    const playerId=court?.[zone];
    if(playerId&&!placed.has(playerId)&&!visual[zone]){visual[zone]=playerId;placed.add(playerId);}
  }
  const remainingPlayers=VISUAL_ZONES.map(z=>court?.[z]).filter(id=>id&&!placed.has(id));
  const remainingZones=VISUAL_ZONES.filter(z=>!visual[z]);
  remainingZones.forEach((z,i)=>{if(remainingPlayers[i])visual[z]=remainingPlayers[i];});
  return visual;
}
function deriveVisualCourt(court,locks,{servingSide=null,phase=null}={}){
  const visual=deriveBaseVisual(court,locks);
  if(servingSide==='team'&&phase==='SERVEI'){
    const server=court?.['1'];
    const serverVisual=VISUAL_ZONES.find(z=>visual[z]===server)||null;
    if(server&&serverVisual&&serverVisual!=='1'){
      const displaced=visual['1'];
      visual['1']=server;
      visual[serverVisual]=displaced;
    }
  }
  return visual;
}
function lockOwnerAt(locks,zone,excludePlayerId=null){
  return Object.keys(locks||{}).find(id=>id!==excludePlayerId&&String(locks[id])===String(zone))||null;
}
function setLock(locks,playerId,zone,court){
  const next=clone(locks), z=String(zone);
  if(!playerId||!ZONES.includes(z)) return {ok:false,reason:'invalid',locks:next};
  const active=activeIds(court);
  for(const [otherId,otherZone] of Object.entries(next)){
    if(otherId!==playerId&&String(otherZone)===z){
      if(active.has(otherId)) return {ok:false,reason:'zone-occupied',owner:otherId,locks:next};
      delete next[otherId];
    }
  }
  next[playerId]=z;
  return {ok:true,locks:next};
}
function toggleLock(locks,playerId,zone,court){
  const next=clone(locks);
  if(String(next[playerId]||'')===String(zone)){delete next[playerId];return {ok:true,unlocked:true,locks:next};}
  return setLock(next,playerId,zone,court);
}
function pruneInactive(locks,court){
  const active=activeIds(court), next={};
  for(const [id,z] of Object.entries(locks||{})) if(active.has(id)&&ZONES.includes(String(z))) next[id]=String(z);
  return sanitizeLocks(next,court);
}
function blockRegZoneForVisual(court,visualCourt,visualZone){
  const pid=visualCourt?.[String(visualZone)];
  const reg=regulatoryZoneOf(court,pid);
  return FRONT_ZONES.has(reg)?reg:null;
}
return {ZONES,VISUAL_ZONES,regulatoryZoneOf,sanitizeLocks,deriveBaseVisual,deriveVisualCourt,setLock,toggleLock,pruneInactive,blockRegZoneForVisual};
});
