const {defineConfig}=require('playwright/test');
module.exports=defineConfig({testDir:'./excel-browser',timeout:45000,workers:1,retries:0,reporter:'list',use:{browserName:'chromium',headless:true,serviceWorkers:'block',acceptDownloads:true}});
