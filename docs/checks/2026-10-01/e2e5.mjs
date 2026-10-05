import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser=await chromium.launch();
const A=await browser.newContext(); const B=await browser.newContext({viewport:{width:390,height:844}});
const pa=await A.newPage(), pb=await B.newPage();
await pa.goto('http://localhost:8080/'); await Promise.all([pa.waitForURL(/\/p\/\d+/), pa.getByRole('button',{name:/dig/i}).click()]);
const url=pa.url(); await pa.fill('input[name=name]','Ava'); await pa.press('input[name=name]','Enter'); await pa.waitForLoadState('load');
const cdp=await B.newCDPSession(pb);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:50000,uploadThroughput:50000});
const tl=Date.now(); await pb.goto(url); console.log('slow network: pond page loaded in', Date.now()-tl,'ms');
await pb.waitForFunction(()=>document.getElementById('live')?.textContent==='live',null,{timeout:10000}); console.log('slow network: live after', Date.now()-tl,'ms');
const lat=[]; for(let i=0;i<4;i++){ const b=await pb.evaluate(()=>document.body.innerText.split('Ava caught').length-1); await pa.locator('#cast').click(); const t=Date.now(); try{await pb.waitForFunction(b=>document.body.innerText.split('Ava caught').length-1>b,b,{timeout:5000,polling:10}); lat.push(Date.now()-t);}catch{lat.push('timeout')} await pa.waitForTimeout(1100); }
console.log('slow network (400 ms latency): B sees A\'s tap after (ms):', lat.join(', '));
await browser.close();
