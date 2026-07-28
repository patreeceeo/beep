/* Grammar expansion verification (Phase 11b): comparisons, number x number ->
   boolean. This is the phase the handoff called "build INTO a boolean slot":
   comparisons cannot arrive by in-place wrap (wrapping a number in `<` would put
   a boolean where a number is expected), so they arrive as palette VALUE
   prototypes dropped onto a condition, firing the ordinary `replace` verb.

   Two halves, same pattern as test-grammar.js + test-phase8.js:
     - unit tests through the window.__lang seam (evalExpr / cmpGlyph / CMPS /
       CMP_FLIP / the cmp constructor), no DOM driving;
     - DOM tests driving the REAL handlers with dispatched pointer/mouse events:
       the shelf, a live drop into a condition, the operand slots inside the
       hexagon, the operator chooser, and the refusals that keep the invariant. */
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
  el.getBoundingClientRect = () => ({
    left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y
  });
}
function pev(type, x, y) {
  return new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
}
async function dragProto(protoEl, x, y, stack) {
  setRect(protoEl, 10, 510, 40, 24);
  protoEl.dispatchEvent(pev('pointerdown', 15, 515));
  window.__stack = stack || [];
  document.dispatchEvent(pev('pointermove', x, y));
  document.dispatchEvent(pev('pointerup', x, y));
  window.__stack = [];
  await sleep(30);         // flush suppressClick (0ms) and render timers
}
// a TAP is a pointerdown/up that never moves, then the click the browser sends
async function tap(el) {
  el.dispatchEvent(pev('pointerdown', 5, 5));
  document.dispatchEvent(pev('pointerup', 5, 5));
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
}
// null-safe: a failing assert should report, not crash the rest of the suite
const NIL = () => document.createElement('span');
const safe = el => el || NIL();
const strip = el => safe(el).textContent.replace(/\s+/g, '');
const popButtons = () => [...document.querySelectorAll('.leaf-pop .opt')];

(async () => {
  await sleep(50);         // let init settle

  const L = window.__lang;
  const { evalExpr, cmpGlyph, CMPS, CMP_FLIP, cmp, bin, num, v, state } = L;
  const C = (op, a, b) => evalExpr(cmp(op, num(a), num(b)));

  /* ---------------------------------------------------------------- the seam */
  console.log('T1: the CMPS registry ships all six tests');
  ok(CMPS.length === 6, 'six comparisons, got ' + CMPS.length);
  const ops = CMPS.map(o => o.op);
  ['<','>','<=','>=','==','!='].forEach(op =>
    ok(ops.indexOf(op) !== -1, op + ' present'));
  // the real invariant that keeps comparisons OUT of bin: every bin op preserves
  // its type, so collapsing a bin always leaves something valid where it sat.
  // A comparison (number->boolean) could never satisfy this, which is exactly why
  // it is its own node type - whereas and/or (boolean->boolean) can and do.
  ok(window.__lang.OPS.every(o => o.in === o.out),
     'every OPS entry is type-PRESERVING (in === out) - that is what makes a bin safe');
  ok(!window.__lang.OPS.some(o => o.in === 'number' && o.out === 'boolean'),
     'no op turns numbers into a boolean - comparisons are not wrap material');

  console.log('T2: cmpGlyph maps every test to its maths glyph');
  ok(cmpGlyph('<') === '<', '<');
  ok(cmpGlyph('>') === '>', '>');
  ok(cmpGlyph('<=') === '≤', '<= -> less-than-or-equal');
  ok(cmpGlyph('>=') === '≥', '>= -> greater-than-or-equal');
  ok(cmpGlyph('==') === '=', '== -> equals');
  ok(cmpGlyph('!=') === '≠', '!= -> not-equal');

  console.log('T3: evalExpr computes every comparison, and yields a BOOLEAN');
  ok(C('<', 2, 3) === true,  '2 < 3');
  ok(C('<', 3, 2) === false, '3 < 2 is false');
  ok(C('>', 5, 1) === true,  '5 > 1');
  ok(C('<=', 4, 4) === true, '4 <= 4 (boundary included)');
  ok(C('<=', 5, 4) === false, '5 <= 4 is false');
  ok(C('>=', 4, 4) === true, '4 >= 4 (boundary included)');
  ok(C('==', 7, 7) === true, '7 = 7');
  ok(C('!=', 7, 7) === false, '7 != 7 is false');
  ok(typeof C('<', 1, 2) === 'boolean', 'the result is a real boolean, not 0/1');

  console.log('T4: operands are full EXPRESSIONS, read from the live backpack');
  const saveX = state.ballX;
  state.ballX = 120;
  ok(evalExpr(cmp('>', v('ballX'), num(100))) === true, 'ballX(120) > 100');
  ok(evalExpr(cmp('>', v('ballX'), num(200))) === false, 'ballX(120) > 200 is false');
  ok(evalExpr(cmp('<', bin('+', v('ballX'), num(5)), num(130))) === true,
     'ballX + 5 < 130 (a bin nests inside a comparison)');
  state.ballX = saveX;

  console.log('T5: CMP_FLIP is the logical NEGATION, and is involutive');
  ok(CMP_FLIP['<'] === '>=', '< opposite is >=');
  ok(CMP_FLIP['>'] === '<=', '> opposite is <=');
  ok(CMP_FLIP['=='] === '!=', '= opposite is !=');
  ops.forEach(op => ok(CMP_FLIP[CMP_FLIP[op]] === op, op + ' flip is involutive'));
  // the real property: flipping inverts the answer for every operand pair
  ok([[1,2],[2,2],[3,2]].every(([a,b]) =>
       ops.every(op => C(op, a, b) === !C(CMP_FLIP[op], a, b))),
     'flip inverts the answer for every op and every ordering');

  console.log('T6: a comparison never parenthesises - it binds looser than any op');
  ok(evalExpr(cmp('==', bin('+', num(2), num(3)), num(5))) === true,
     '2 + 3 = 5 groups as (2+3) = 5, not 2 + (3=5)');

  console.log('T7: a /0 inside a comparison is still detected');
  ok(L.dividesByZero(cmp('<', bin('/', num(1), num(0)), num(5))),
     'detector walks INTO a comparison and finds the /0');
  ok(!L.dividesByZero(cmp('<', bin('/', num(1), num(2)), num(5))),
     'a safe division inside a comparison stays clear');

  /* ------------------------------------------------------------------- the DOM */
  const paletteEl = document.getElementById('palette');
  const trayEl = document.getElementById('tray');
  const trashEl = document.getElementById('trash');
  setRect(trayEl, 600, 0, 200, 60);
  setRect(trashEl, 900, 0, 74, 60);

  console.log('T8: the shelf auto-derived one hexagon per comparison');
  const cmpProtos = [...paletteEl.querySelectorAll('.pred.proto.cmp')];
  ok(cmpProtos.length === 6, 'six comparison tiles, got ' + cmpProtos.length);
  const shelfGlyphs = cmpProtos.map(e => strip(e));
  ok(shelfGlyphs.indexOf('0<0') !== -1, 'the < tile reads "0 < 0"');
  ok(shelfGlyphs.indexOf('0≠0') !== -1, 'the != tile shows the not-equal glyph');
  ok(cmpProtos.every(e => e.classList.contains('pred')),
     'they wear the gold hexagon - they read as booleans, like the sensors');

  console.log('T9: a comparison REPLACES a sensor in a condition (the build-into flow)');
  // focus an ifjump: its condition becomes a live slot
  const blocks = [...document.querySelectorAll('.block')];
  const ifBlock = blocks.find(b => /isKeyPressed/.test(b.textContent));
  ok(!!ifBlock, 'found a key-sensor ifjump to work on');
  await tap(safe(ifBlock).querySelector('.content') || NIL());
  const condEl = safe(ifBlock).querySelector('.pred[data-sl]');
  ok(!!condEl, 'the focused condition is a live slot');
  const trayBefore = trayEl.children.length;

  const ltProto = cmpProtos[ops.indexOf('<')];
  await dragProto(ltProto, 300, 300, condEl ? [condEl] : []);
  const newCond = safe(ifBlock).querySelector('.pred.cmp[data-sl]');
  ok(!!newCond, 'the condition is now a comparison hexagon');
  ok(strip(newCond) === '0<0', 'it reads "0 < 0", got ' + strip(newCond));
  ok(trayEl.children.length === trayBefore + 1, 'the displaced sensor retreated to the spares');
  ok(/isKeyPressed/.test(trayEl.textContent), 'and it is the sensor that was there');
  ok(paletteEl.querySelectorAll('.pred.proto.cmp').length === 6, 'the prototype stayed on the shelf');

  console.log('T10: the operands inside are REAL slots (ordinary number material)');
  const operands = [...safe(newCond).querySelectorAll('.token[data-sl]')];
  ok(operands.length === 2, 'two live operand slots, got ' + operands.length);
  ok(operands.every(e => e.classList.contains('num')), 'both are number tokens');
  // drop a variable prototype onto the left operand - the plain Phase-8 rule
  const varProto = [...paletteEl.querySelectorAll('.token.var.proto')].find(e => strip(e) === 'ballX');
  await dragProto(varProto, 300, 300, operands[0] ? [operands[0]] : []);
  const grown = safe(ifBlock).querySelector('.pred.cmp[data-sl]');
  ok(strip(grown) === 'ballX<0', 'left operand became ballX, got ' + strip(grown));

  console.log('T11: the operator glyph is the handle - tap it to change the test');
  const opEl = safe(grown).querySelector('.cmp-op[data-op]');
  ok(!!opEl, 'the operator carries a data-op handle, like a bin');
  if (opEl) await tap(opEl);
  const btns = popButtons();
  ok(btns.length >= 7, 'chooser offers the opposite + all six tests, got ' + btns.length);
  ok(btns[0] && /the opposite/.test(btns[0].textContent), 'the negation is offered first');
  ok(btns[0] && /≥/.test(btns[0].textContent), 'and for < the opposite shown is >=');
  const gt = btns.find(b => b.textContent === '>') || NIL();
  gt.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(20);
  const flipped = safe(ifBlock).querySelector('.pred.cmp[data-sl]');
  ok(strip(flipped) === 'ballX>0', 'the test is now >, got ' + strip(flipped));
  ok(!document.querySelector('.leaf-pop'), 'the chooser closed after choosing');

  console.log('T12: the invariant - a comparison operand can never be removed');
  const liveOperands = [...safe(flipped).querySelectorAll('.token[data-sl]')];
  if (liveOperands[1]) await tap(liveOperands[1]);
  const zoneBtns = popButtons().map(b => b.textContent);
  ok(!zoneBtns.some(t => /spare tiles|trash/.test(t)),
     'the operand chooser offers no way out - removal would empty a required slot');
  const wrapBtns = popButtons().filter(b => /^\+ 0$/.test(b.textContent));
  ok(wrapBtns.length === 1, 'but it CAN be grown: "wrap in +" is offered');
  document.dispatchEvent(pev('pointerdown', 1, 1));   // dismiss
  await sleep(20);

  console.log('T13: the comparison itself is a required slot, and boolean-typed');
  const stillThere = document.querySelector('.pred.cmp[data-sl]');
  if (stillThere) await tap(stillThere);
  const cmpMenu = popButtons().map(b => b.textContent);
  ok(cmpMenu.some(t => /the opposite/.test(t)), 'tapping the hexagon opens the same chooser');
  ok(!cmpMenu.some(t => /spare tiles|trash/.test(t)),
     'no way out: it fills a condition, which may never be emptied');
  ok(!cmpMenu.some(t => /^[+−×÷] /.test(t)),
     'and no arithmetic wrap is offered - it is a boolean, not a number');
  document.dispatchEvent(pev('pointerdown', 1, 1));
  await sleep(20);

  console.log('T14: the type gate REFUSES a comparison in a number slot');
  const D = window.__drop;
  ok(D.verbFor('proto-value', 'slot') === 'replace',
     'a comparison rides the ordinary proto-value -> slot verb (no new table row)');
  ok(D.PAYLOADS.indexOf('proto-value') !== -1 && D.PAYLOADS.length === 7,
     'the payload set is unchanged - comparisons needed no new payload');
  // focus an ASSIGN: its RHS operands are number slots, where a boolean may never go
  const asgBlock = [...document.querySelectorAll('.block')]
    .find(b => /ballX =|ballY =/.test(b.textContent.replace(/\s+/g, ' ')));
  await tap(safe(asgBlock).querySelector('.content') || NIL());
  const numSlot = safe(asgBlock).querySelector('.token[data-sl]');
  ok(!!numSlot, 'the assign exposes a number slot');
  const numSlotText = strip(numSlot);
  await dragProto(cmpProtos[ops.indexOf('<')], 300, 300, numSlot ? [numSlot] : []);
  ok(!safe(asgBlock).querySelector('.pred.cmp'),
     'the comparison was REFUSED - a boolean cannot fill a number slot');
  ok(strip(safe(asgBlock).querySelector('.token[data-sl]')) === numSlotText,
     'and the number slot is untouched, got ' + strip(safe(asgBlock).querySelector('.token[data-sl]')));

  console.log('T15: the edit landed in the TREE, and Beep runs it');
  // the compact (unfocused) row renders straight from the AST, so reading it back
  // proves the drop + operator change mutated the program, not just the view
  await tap(document.querySelector('#blocksBox'));       // unfocus
  await sleep(20);
  const rowText = strip(safe(ifBlock).querySelector('.content')) ? safe(ifBlock).querySelector('.content').textContent.replace(/\s+/g, ' ').trim() : '';
  ok(/ballX > 0/.test(rowText), 'the compact row reads "if ballX > 0 ...", got ' + rowText);

  // execStmt is the interpreter's whole contract for a statement; drive it directly
  // (stepInstant paints the robot but does not fill the bubble)
  state.ballX = -5;
  const no = L.execStmt({ type:'ifjump', cond: cmp('>', v('ballX'), num(0)), target:'goLeft' });
  ok(!no.jump, 'ballX(-5) > 0 is false, so Beep does not jump');
  ok(/-5/.test(no.bubble), 'the bubble substitutes the LIVE operand value, got ' + no.bubble);
  ok(/\? no$/.test(no.bubble), 'and reports the answer, got ' + no.bubble);
  state.ballX = 40;
  const yes = L.execStmt({ type:'ifjump', cond: cmp('>', v('ballX'), num(0)), target:'goLeft' });
  ok(yes.jump === 'goLeft', 'ballX(40) > 0 is true, so Beep jumps');

  // and the whole program, comparison included, still steps without confusing him
  const robot = document.getElementById('robot');
  let everConfused = false;
  for (let k = 0; k < 24; k++){
    L.stepInstant();
    if (robot.classList.contains('confused')) everConfused = true;
  }
  ok(!everConfused, 'Beep steps the program containing a comparison without stalling');

  console.log('T15b: a /0 inside a condition halts Beep, like one in an assign');
  const halt = L.execStmt({ type:'ifjump', cond: cmp('<', bin('/', num(1), num(0)), num(5)),
                            target:'start' });
  ok(halt.divZero === true, 'a condition that divides by zero refuses to decide');
  ok(!halt.jump, 'and it does NOT jump - the error is not silently resolved');
  const fine = L.execStmt({ type:'ifjump', cond: cmp('<', num(1), num(5)), target:'start' });
  ok(!fine.divZero && fine.jump === 'start', 'a healthy comparison still jumps');

  console.log('T16: Reset restores a condition that was replaced by a comparison');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  ok(!document.querySelector('.block .pred.cmp'),
     'the program is back to its seed - the comparison is gone');
  ok(/isKeyPressed/.test(document.body.textContent), 'the original sensors are back');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
