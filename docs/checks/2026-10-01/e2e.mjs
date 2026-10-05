import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const BASE='http://localhost:8080';
const out=[]; const log=(...a)=>{const s=a.join(' ');out.push(s);console.log(s)};
const browser=await chromium.launch();
const A=await browser.newContext({viewport:{width:1920,height:1080}});
const B=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const pa=await A.newPage(), pb=await B.newPage();
for (const [n,p] of [['A',pa],['B',pb]]) { p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')log(`[${n} console ${m.type()}]`,m.text())}); p.on('pageerror',e=>log(`[${n} pageerror]`,e.message)); }

// A: home, dig using keyboard only
await pa.goto(BASE+'/'); await pa.screenshot({path:'shots/01-home-desktop.png',fullPage:true});
let tabs=0; while(tabs<15){ await pa.keyboard.press('Tab'); tabs++; const t=await pa.evaluate(()=>document.activeElement?.textContent?.trim()); if(/dig/i.test(t||'')) break; }
log('A: Tab presses to reach Dig:',tabs);
await Promise.all([pa.waitForURL(/\/p\/\d+/), pa.keyboard.press('Enter')]);
const pondUrl=pa.url(); log('pond url',pondUrl);
await pa.screenshot({path:'shots/02-pond-before-join-desktop.png',fullPage:true});
// A joins with keyboard
tabs=0; while(tabs<15){ await pa.keyboard.press('Tab'); tabs++; const tag=await pa.evaluate(()=>document.activeElement?.tagName+':'+(document.activeElement?.getAttribute('name')||'')); if(tag==='INPUT:name') break; }
log('A: Tab presses to reach name field:',tabs);
await pa.keyboard.type('Ava'); await pa.keyboard.press('Enter'); await pa.waitForLoadState('load');
log('A page says You are:', await pa.locator('text=You are').count()>0);
// B joins on mobile
await pb.goto(pondUrl); await pb.screenshot({path:'shots/03-pond-before-join-mobile.png',fullPage:true});
await pb.fill('input[name=name]','Ben'); await pb.locator('input[name=name]').press('Enter'); await pb.waitForLoadState('load');
await pa.waitForTimeout(1500);
await pa.screenshot({path:'shots/04-both-joined-desktop.png',fullPage:true});
await pb.screenshot({path:'shots/05-both-joined-mobile.png',fullPage:true});
const avail=async p=>p.evaluate(()=>document.body.innerText.match(/(\d+)\s*(fish|left)/i)?.[0]);
log('A sees', await avail(pa), '| B sees', await avail(pb));

// Latency: A presses Space (after focusing body), B should see "Ava caught" within 1s
const lat=[];
for (let i=0;i<5;i++){
  const before=await pb.evaluate(()=>document.body.innerText.split('Ava caught').length-1);
  await pa.locator('body').click({position:{x:5,y:5}}).catch(()=>{});
  const t0=Date.now(); await pa.keyboard.press('Space');
  try { await pb.waitForFunction(b=>document.body.innerText.split('Ava caught').length-1>b, before, {timeout:3000, polling: 10}); lat.push(Date.now()-t0); }
  catch { lat.push('timeout'); }
  await pa.waitForTimeout(1100);
}
log('A Space -> B sees it (ms):', lat.join(', '));
// Too-soon feedback
await pa.keyboard.press('Space'); await pa.keyboard.press('Space'); await pa.waitForTimeout(200);
await pa.screenshot({path:'shots/06-cooldown-desktop.png',fullPage:true});
log('A status text after double tap:', JSON.stringify(await pa.evaluate(()=>[...document.querySelectorAll('[role=status],[aria-live],.status,output')].map(e=>e.innerText).join(' | '))));
// B casts keyboard-only via Tab to button
tabs=0; let found=false; while(tabs<25){ await pb.keyboard.press('Tab'); tabs++; const t=await pb.evaluate(()=>document.activeElement?.tagName+':'+document.activeElement?.textContent?.trim()); if(/^BUTTON:.*cast/i.test(t)){found=true;break;} }
log('B: Tab presses to reach Cast:',found?tabs:'not found');
if(found){ await pb.keyboard.press('Enter'); await pb.waitForTimeout(800); }
log('A sees Ben caught:', await pa.evaluate(()=>document.body.innerText.includes('Ben caught')));
// Resize mid-use
await pa.setViewportSize({width:390,height:844}); await pa.waitForTimeout(300);
const hscroll=await pa.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
log('A resized to 390 mid-use, horizontal scroll:', hscroll);
await pa.screenshot({path:'shots/07-desktop-resized-to-mobile.png',fullPage:true});
await pa.setViewportSize({width:1920,height:1080});
const hscrollB=await pb.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
log('B (390) horizontal scroll:', hscrollB);
// Offline / reconnect: B goes offline, A catches twice, B back online
await B.setOffline(true); await pb.waitForTimeout(500);
for(let i=0;i<2;i++){ await pa.keyboard.press('Space'); await pa.waitForTimeout(1100); }
const countOffline=await pb.evaluate(()=>document.body.innerText.split('Ava caught').length-1);
await B.setOffline(false);
const t1=Date.now();
try{ await pb.waitForFunction(c=>document.body.innerText.split('Ava caught').length-1>=c+2, countOffline, {timeout:15000}); log('B caught up after reconnect in ms:', Date.now()-t1); } catch { log('B did NOT catch up within 15 s after reconnect'); }
await pb.screenshot({path:'shots/08-mobile-after-reconnect.png',fullPage:true});
// Persistence: reload A
await pa.reload(); await pa.waitForTimeout(800);
log('After reload A still "You are Ava":', await pa.evaluate(()=>document.body.innerText.includes('You are Ava')));
log('A catches shown:', await pa.evaluate(()=>document.body.innerText.match(/Ava[^\n]{0,40}/g)?.slice(0,3).join(' / ')));
await browser.close();
import('fs').then(fs=>fs.writeFileSync('e2e-out.txt',out.join('\n')));
