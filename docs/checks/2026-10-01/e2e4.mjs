import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
const start=()=>{const out=fs.openSync('/tmp/claude-0/server.log','a');const p=spawn('node',['src/server.ts'],{cwd:'/home/claude/cp',env:{...process.env,DATA_DIR:'/tmp/claude-0/pdata',PORT:'8080'},stdio:['ignore',out,out],detached:true}); p.unref(); fs.writeFileSync('/tmp/claude-0/server.pid',String(p.pid)); return p;};
const browser=await chromium.launch();
const A=await browser.newContext({viewport:{width:1920,height:1080}}); const B=await browser.newContext({viewport:{width:390,height:844}});
const pa=await A.newPage(), pb=await B.newPage();
// fresh pond, two nets
await pa.goto('http://localhost:8080/'); await Promise.all([pa.waitForURL(/\/p\/\d+/), pa.getByRole('button',{name:/dig/i}).click()]);
const url=pa.url(); await pa.fill('input[name=name]','Ava'); await pa.press('input[name=name]','Enter'); await pa.waitForLoadState('load');
await pb.goto(url); await pb.fill('input[name=name]','Ben'); await pb.press('input[name=name]','Enter'); await pb.waitForLoadState('load'); await pb.waitForTimeout(1200);
const cnt=(p,n)=>p.evaluate(n=>document.body.innerText.split(n+' caught').length-1,n);
// 1) server restart
process.kill(Number(fs.readFileSync('/tmp/claude-0/server.pid','utf8')),'SIGTERM'); const tDown=Date.now();
await pb.waitForTimeout(1500); console.log('B live label while server down:', await pb.locator('#live').textContent());
start(); await pa.waitForTimeout(1500);
const before=await cnt(pb,'Ava');
await pa.locator('#cast').click(); const t0=Date.now();
try{ await pb.waitForFunction(b=>document.body.innerText.split('Ava caught').length-1>b, before,{timeout:15000}); console.log('after restart: B saw A\'s catch', Date.now()-t0,'ms after the tap (server was down', t0-tDown,'ms)'); }catch{ console.log('after restart: B did NOT see A\'s catch in 15 s'); }
console.log('B live label now:', await pb.locator('#live').textContent());
// 2) slow network for B (CDP): 400 ms latency each way, 400 kbit/s
const cdp=await B.newCDPSession(pb);
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:50000,uploadThroughput:50000});
await pb.waitForTimeout(1200);
const lat=[]; for(let i=0;i<4;i++){ const b=await cnt(pb,'Ava'); await pa.locator('#cast').click(); const t=Date.now(); try{await pb.waitForFunction(b=>document.body.innerText.split('Ava caught').length-1>b,b,{timeout:5000}); lat.push(Date.now()-t);}catch{lat.push('timeout')} await pa.waitForTimeout(1100); }
console.log('slow network B sees A\'s tap (ms):', lat.join(', '));
// B casts on slow network: time until B itself sees result
const bt=Date.now(); await pb.locator('#cast').click(); await pb.waitForFunction(()=>/caught a fish|Too soon|Network/.test(document.getElementById('status')?.textContent||''),null,{timeout:10000}); console.log('slow network: B\'s own cast confirmed in', Date.now()-bt,'ms; status:', await pb.locator('#status').textContent());
await pb.screenshot({path:'shots/09-mobile-slow-network.png',fullPage:true});
await browser.close();
