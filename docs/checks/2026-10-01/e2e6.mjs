import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser=await chromium.launch();
const ctxA=await browser.newContext({viewport:{width:1920,height:1080}});
// reuse Ava's cookie is not possible here; join a fresh pond? instead read the token from the db
import { DatabaseSync } from 'node:sqlite';
const db=new DatabaseSync('/tmp/claude-0/pdata/pond.db'); const tok=db.prepare("SELECT token FROM nets WHERE pond=1 AND name='Ava'").get().token;
await ctxA.addCookies([{name:'net_1',value:tok,domain:'localhost',path:'/p/1'}]);
const B=await browser.newContext({viewport:{width:390,height:844}});
const pa=await ctxA.newPage(), pb=await B.newPage();
await pa.goto('http://localhost:8080/p/1'); await pb.goto('http://localhost:8080/p/1'); await pa.waitForTimeout(1200);
await pa.locator('#cast').click(); await pa.waitForTimeout(3500);
await pa.screenshot({path:'shots/10-dead-desktop.png',fullPage:true}); await pb.screenshot({path:'shots/11-dead-mobile-watcher.png',fullPage:true});
console.log('B (watcher) text mentions death:', await pb.evaluate(()=>/died/i.test(document.body.innerText)));
const home=await browser.newPage({viewport:{width:1920,height:1080}}); await home.goto('http://localhost:8080/'); await home.screenshot({path:'shots/12-home-with-ponds.png',fullPage:true});
await browser.close();
