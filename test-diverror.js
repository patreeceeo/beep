/* Divide-by-zero as an ERROR (Phase 11a follow-up). Two behaviours:
   (1) authoring a '/' whose divisor is currently 0 summons Beep's nemesis as a
       WARNING; (2) when Beep reaches a live /0 at run time he stops, confused,
       and the assign refuses to write (pc parks on the broken row). Unit checks
       go through the window.__lang seam; the warning + confusion are proven by
       driving real gestures and the synchronous stepInstant. */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/beep.html', 'utf-8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  beforeParse(window) {
    window.requestAnimationFrame = cb => setTimeout(cb, 0);
    window.Element.prototype.setPointerCapture = function(){};
    window.Element.prototype.releasePointerCapture = function(){};
    window.document.elementsFromPoint = () => window.__stack || [];
  }
});
const { window } = dom;
const { document } = window;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ok - ' + name); }
  else { failed++; console.log('  FAIL - ' + name); }
}
function setRect(el, x, y, w, h) {
  el.getBoundingClientRect = () => ({ left:x, top:y, right:x+w, bottom:y+h, width:w, height:h, x, y });
}
function pev(type, x, y) {
  return new window.MouseEvent(type, { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0 });
}
async function dragProto(protoEl, x, y, stack) {
  setRect(protoEl, 10, 510, 40, 24);
  protoEl.dispatchEvent(pev('pointerdown', 15, 515));
  window.__stack = stack || [];
  document.dispatchEvent(pev('pointermove', x, y));
  document.dispatchEvent(pev('pointerup', x, y));
  window.__stack = [];
  await sleep(30);
}

(async () => {
  await sleep(50);
  const L = window.__lang;
  const { bin, num } = L;

  const paletteEl = document.getElementById('palette');
  setRect(document.getElementById('tray'), 600, 0, 200, 60);
  setRect(document.getElementById('trash'), 900, 0, 74, 60);
  const nemesis = document.getElementById('nemesis');
  const robot = document.getElementById('robot');

  console.log('T1: evalExpr treats /0 as an error, not a silent 0');
  ok(L.divCheck(bin('/', num(5), num(0))).divByZero === true, '5 / 0 flags divByZero');
  ok(L.divCheck(bin('/', num(6), num(3))).divByZero === false, '6 / 3 is fine');
  ok(Number.isFinite(L.divCheck(bin('/', num(5), num(0))).value), 'flagged result stays finite');

  console.log('T2: an assign that divides by zero refuses the write');
  // Phase 20e: no world variables - a top-level name exists because a row made
  // it, so make one here the way the seed program does
  L.state.ballX = 50;
  const before = L.state.ballX;
  const r = L.execStmt({ type:'assign', target:'ballX', expr: bin('/', num(1), num(0)) });
  ok(r.divZero === true, 'execStmt surfaces divZero');
  ok(L.state.ballX === before, 'state was NOT written on /0');
  const r2 = L.execStmt({ type:'assign', target:'ballX', expr: num(before + 3) });
  ok(!r2.divZero && L.state.ballX === before + 3, 'a safe assign still writes normally');
  L.state.ballX = before;                                   // restore

  console.log('T3: authoring a /0 summons the nemesis as a warning');
  ok(!nemesis.classList.contains('warn'), 'no warning before any /0 is authored');
  const assignContent = [...document.querySelectorAll('.block.assign .content')]
    .find(c => /ballX/.test(c.textContent) && /ballVelocityX/.test(c.textContent));
  assignContent.dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(10);

  const divTile = [...paletteEl.querySelectorAll('.optile.proto')].find(e => e.textContent === '÷');
  const target  = [...assignContent.querySelectorAll('.token.var')].find(t => t.textContent === 'ballVelocityX');
  await dragProto(divTile, 100, 100, [target]);
  ok(assignContent.querySelector('.group') !== null, 'ballVelocityX wrapped in a division group');
  ok(!nemesis.classList.contains('warn'), 'still no warning - the divisor seeded to 1');

  const divisor = [...assignContent.querySelectorAll('.token.num')].find(t => t.textContent === '1');
  divisor.dispatchEvent(pev('pointerdown', 60, 60));
  divisor.dispatchEvent(pev('pointerup', 60, 60));           // tap (no move) opens the number chooser
  await sleep(10);
  const inp = document.querySelector('.numedit');
  ok(!!inp, 'number chooser opened on the divisor');
  inp.value = '0';
  inp.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
  await sleep(10);
  ok(nemesis.classList.contains('warn'), 'the nemesis pops in as a warning on the fresh /0');
  ok(nemesis.classList.contains('here'), 'the nemesis is visible (here)');

  console.log('T4: at run time Beep reaches the /0 and stops, confused');
  const ballXbefore = L.state.ballX;
  // Phase 20d: fifteen setup rows run before the loop, so give him room to reach it
  let confused = false, steps = 0;
  for (let k = 0; k < 40 && !confused; k++){
    L.stepInstant(); steps++;
    if (robot.classList.contains('confused')) confused = true;
  }
  ok(confused, 'Beep becomes confused when execution reaches the divide-by-zero (in ' + steps + ' steps)');
  ok(L.state.ballX === ballXbefore, 'the broken assign never wrote its target');
  L.stepInstant();
  ok(robot.classList.contains('confused'), 'he stays confused - pc parks on the broken row');

  console.log('T6: a /0 in a `move` coordinate refuses the move (Phase 17)');
  // move's x and y are ordinary expressions, so they answer to the same rule an
  // assign does: a poisoned coordinate refuses the write and parks Beep.
  const C = window.__call, Bd = C.build;
  /* Phase 20d: there is no sprite called `ball` any more - the program mints
     its own. Make one here the way the seed does, then poison its coordinate. */
  const ballId = L.mintInstance('Ball');
  L.placeSprite(ballId, 20, 20);
  C.load([ Bd.move(ballId, bin('/', num(5), num(0)), num(30)), Bd.label('end') ]);
  L.stepInstant();
  ok(L.evalExpr(L.propOf('x', L.sprite(ballId))) === 20, 'the sprite did not move');
  ok(/does not compute/.test(document.getElementById('bubble').textContent),
     'and Beep says why: ' + document.getElementById('bubble').textContent);
  ok(C.pc() === 0, 'pc parked on the move row');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
