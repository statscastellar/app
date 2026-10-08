(()=>{'use strict';
const KEY='StatsCastellarPro2_CurrentDraft_v1';
const deep=x=>JSON.parse(JSON.stringify(x));
function now(){return new Date().toISOString()}
function blank(){return {schemaVersion:1,draftId:(crypto.randomUUID?crypto.randomUUID():'draft-'+Date.now()),team:null,match:{opponent:'',date:'',venue:'home'},rosterSnapshot:[],calledPlayerIds:[],startingSixIds:[],positions:{},initialServe:{side:'rival',serverPlayerId:null},completedSteps:{step1:false,step2:false,step3:false,step4:false},createdAt:now(),updatedAt:now()};}
function get(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){return null}}
function save(d){d.updatedAt=now();sessionStorage.setItem(KEY,JSON.stringify(d));return deep(d)}
function current(){return get()||save(blank())}
function reset(){const d=blank();save(d);return d}
window.Pro2DraftStore={get,current,save,reset,clear:()=>sessionStorage.removeItem(KEY)};
})();
