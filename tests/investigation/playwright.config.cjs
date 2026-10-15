const path=require('node:path');
const base=require('../playwright.config.cjs');
module.exports={...base,testDir:__dirname,outputDir:path.resolve(__dirname,'../reports/followup/artifacts'),reporter:[['list'],['json',{outputFile:path.resolve(__dirname,'../reports/followup/results.json')}]],webServer:{...base.webServer,cwd:path.resolve(__dirname,'..')}};
