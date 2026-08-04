/* trajectory fingerprint: the SEQUENCE of ball positions and velocity flips,
   independent of how many statements the program takes to get going. */
const { JSDOM } = require('jsdom'); const fs=require('fs'), crypto=require('crypto');
const dom = new JSDOM(fs.readFileSync(process.argv[2],'utf-8'),{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){
  w.requestAnimationFrame=cb=>setTimeout(cb,0);
  w.Element.prototype.setPointerCapture=function(){}; w.Element.prototype.releasePointerCapture=function(){};
  w.document.elementsFromPoint=()=>[];}});
const {window}=dom;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const press=(k,d)=>window.document.dispatchEvent(new window.KeyboardEvent(d?'keydown':'keyup',{key:k,bubbles:true}));
(async()=>{
  await sleep(140);
  const st=window.document.getElementById('stage');
  Object.defineProperty(st,'clientWidth',{value:404,configurable:true});
  Object.defineProperty(st,'clientHeight',{value:240,configurable:true});
  const L=window.__lang, out=[];
  const idOf = n => (L.state && L.state[n] !== undefined) ? L.state[n] : n;
  for (const mode of ['idle','left','right']){
    window.document.getElementById('btnReset').click();
    await sleep(60);
    if (mode==='left') press('ArrowLeft',true);
    if (mode==='right') press('ArrowRight',true);
    let seen='';
    for (let i=0;i<4000;i++){
      L.stepInstant();
      // Phase 20e: the numbers are declared by the program, so skip the sampling
      // until its setup rows have made them
      if (L.state.ballX === undefined || L.state.ballY === undefined) continue;
      const k = L.state.ballX.toFixed(3)+','+L.state.ballY.toFixed(3)+','+L.state.ballVelocityX+','+L.state.ballVelocityY
              + ','+L.state.paddleX
              + ',' + ['brick1','brick2','brick3'].map(n=>L.spriteAlive[idOf(n)]?1:0).join('');
      if (k!==seen){ out.push(mode+' '+k); seen=k; }
    }
    if (mode==='left') press('ArrowLeft',false);
    if (mode==='right') press('ArrowRight',false);
  }
  const text=out.join('\n');
  fs.writeFileSync(process.argv[3], text);
  console.log('states='+out.length+' sha256='+crypto.createHash('sha256').update(text).digest('hex'));
})();
