const base=require('../playwright.config.cjs');
module.exports={...base,testDir:'.',testMatch:'visual-audit.spec.cjs',outputDir:'../reports/visual-audit/artifacts',reporter:[['list'],['json',{outputFile:'reports/visual-audit/playwright.json'}]],webServer:{...base.webServer,cwd:require('node:path').resolve(__dirname,'..')}};
