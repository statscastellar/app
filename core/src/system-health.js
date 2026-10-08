'use strict';
const { clone } = require('./utils');
const { Pro2Storage } = require('./storage-service');
const { Pro2BackupService } = require('./backup-service');
const { migrateTeam, migrateActiveRecord, migrateCompletedRecord } = require('./schema-migrations');

function issue(scope, error, id=null) {
  return {scope,id,code:error?.code||null,message:error?.message||String(error)};
}

class Pro2SystemHealth {
  constructor(adapter){ this.adapter=adapter; }

  async run(options={}) {
    const now=options.now||new Date().toISOString();
    const storage=new Pro2Storage(this.adapter);
    const backup=new Pro2BackupService(this.adapter);
    const errors=[]; const warnings=[];
    const counts={teams:0,activeMatches:0,completedMatches:0,staleConflicts:0,pendingConflicts:0};
    let maintenance={status:'unsupported',recoveryRequired:false};

    try { maintenance=await backup.getMaintenanceStatus({now}); }
    catch(e){ errors.push(issue('maintenance',e)); }
    if(maintenance.recoveryRequired) warnings.push({scope:'maintenance',code:'RECOVERY_PENDING',message:'Hi ha una operació de manteniment pendent de reconciliació.'});

    try {
      const rows=await this.adapter.listEntries('teams'); counts.teams=rows.length;
      for(const row of rows) { try { migrateTeam(row.value); } catch(e){ errors.push(issue('team',e,row.id)); } }
    } catch(e){ errors.push(issue('teams-store',e)); }

    try {
      const rows=await this.adapter.listEntries('activeMatches'); counts.activeMatches=rows.length;
      if(rows.length>1) errors.push({scope:'activeMatches',code:'MULTIPLE_ACTIVE_MATCHES',message:'Hi ha més d’un partit actiu.',count:rows.length});
      for(const row of rows) {
        try { migrateActiveRecord(row.value); await storage.loadActive(row.id); }
        catch(e){ errors.push(issue('activeMatch',e,row.id)); }
      }
    } catch(e){ errors.push(issue('active-store',e)); }

    try {
      const rows=await this.adapter.listEntries('completedMatches'); counts.completedMatches=rows.length;
      for(const row of rows) {
        try { migrateCompletedRecord(row.value); await storage.getHistory(row.id); }
        catch(e){ errors.push(issue('completedMatch',e,row.id)); }
      }
    } catch(e){ errors.push(issue('completed-store',e)); }

    try {
      const conflicts=await storage.listStaleConflictAudit();
      counts.staleConflicts=conflicts.length;
      counts.pendingConflicts=conflicts.filter(c=>(c.lifecycle?.status||'pending')==='pending').length;
      if(counts.pendingConflicts) warnings.push({scope:'staleConflicts',code:'PENDING_CONFLICTS',message:`Hi ha ${counts.pendingConflicts} conflicte(s) pendent(s) de resolució.`});
      for(const c of conflicts) if(c.resolution?.status==='resolved') {
        try { await storage.verifyStaleConflictAuditTrail(c.conflictId); }
        catch(e){ errors.push(issue('staleConflictAudit',e,c.conflictId)); }
      }
    } catch(e){ errors.push(issue('staleConflicts',e)); }

    const status=errors.length?'error':warnings.length?'attention':'healthy';
    return {version:1,checkedAt:now,status,ok:errors.length===0,counts,maintenance:clone(maintenance),warnings,errors};
  }
}

module.exports={Pro2SystemHealth};
