/* Grammar expansion verification (Phase 11c): boolean literals, and/or, not.

   The shape of this phase is the mirror image of Phase 11b. Comparisons are
   number->boolean, so they could NOT arrive by in-place wrap and needed their own
   node type plus a palette value tile. and/or are boolean->BOOLEAN, so they are
   legal `bin` ops and arrive through the wrap door that already existed - the
   only new machinery is a boolean literal to seed the identity with. `not` is the
   odd one: unary AND identity-less, so it gets its own node type (cmp's
   precedent) and a handle that can undo it.

   The invariant this suite is really guarding: a bin may host an op iff
   in === out, because that is what makes collapse safe. */
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
  await sleep(30);
}
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
const clickBtn = b => safe(b).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

(async () => {
  await sleep(50);

  const L = window.__lang;
  const { evalExpr, OPS, UNARY_OPS, FLIP, bool, notOf, cmp, bin, num, v, typeOf, state } = L;

  /* ---------------------------------------------------------------- the seam */
  console.log('T1: the boolean literal');
  ok(evalExpr(bool(true)) === true, 'yes evaluates true');
  ok(evalExpr(bool(false)) === false, 'no evaluates false');
  ok(typeOf(bool(true)) === 'boolean', 'a literal is boolean-typed');
  ok(bool(1).value === true && bool(0).value === false, 'the constructor coerces to a real boolean');

  console.log('T2: and/or joined OPS as boolean->boolean');
  const byOp = Object.fromEntries(OPS.map(o => [o.op, o]));
  ok(!!byOp['and'] && !!byOp['or'], 'and and or are in OPS');
  ok(byOp['and'].in === 'boolean' && byOp['and'].out === 'boolean', 'and is boolean->boolean');
  ok(byOp['or'].in === 'boolean' && byOp['or'].out === 'boolean', 'or is boolean->boolean');
  ok(byOp['and'].identity === true, 'and seeds identity yes');
  ok(byOp['or'].identity === false, 'or seeds identity no');

  console.log('T3: THE BIN INVARIANT - every bin op preserves its type');
  // this is the whole reason and/or may live in a bin while a comparison may not:
  // collapsing a bin leaves one operand behind, which must still fit the slot
  ok(OPS.every(o => o.in === o.out), 'every OPS entry has in === out');
  ok(UNARY_OPS.every(o => o.in === o.out), 'the unary registry too');
  ok(OPS.concat(UNARY_OPS).every(o => o.in === o.out),
     'so collapsing ANY operation always leaves a type-valid operand behind');

  console.log('T4: a bin now takes its TYPE from its operation');
  ok(typeOf(bin('+', num(1), num(2))) === 'number', '1 + 2 is a number');
  ok(typeOf(bin('and', bool(true), bool(false))) === 'boolean', 'yes and no is a boolean');
  ok(typeOf(bin('or', bool(true), bool(false))) === 'boolean', 'yes or no is a boolean');

  console.log('T5: evalExpr computes and/or over every combination');
  const AND = (a, b) => evalExpr(bin('and', bool(a), bool(b)));
  const OR  = (a, b) => evalExpr(bin('or',  bool(a), bool(b)));
  ok(AND(true, true) === true, 'yes and yes');
  ok(AND(true, false) === false, 'yes and no');
  ok(AND(false, true) === false, 'no and yes');
  ok(AND(false, false) === false, 'no and no');
  ok(OR(true, false) === true, 'yes or no');
  ok(OR(false, false) === false, 'no or no');
  ok(OR(true, true) === true, 'yes or yes');
  ok(typeof AND(true, false) === 'boolean', 'the result is a real boolean');

  console.log('T6: wrapping in an identity is a behaviour NO-OP (the whole point)');
  // this is why a boolean literal had to exist: it is what wrap seeds
  [true, false].forEach(x => {
    ok(AND(x, byOp['and'].identity) === x, boolWordJS(x) + ' and yes = ' + boolWordJS(x));
    ok(OR(x, byOp['or'].identity) === x, boolWordJS(x) + ' or no = ' + boolWordJS(x));
  });
  const seeded = L.identityNode(byOp['and']);
  ok(seeded.type === 'bool' && seeded.value === true, 'wrap seeds a bool node for and, not a number');
  ok(L.identityNode(byOp['+']).type === 'num', 'and still seeds a num node for +');

  console.log('T7: unary not');
  ok(evalExpr(notOf(bool(true))) === false, 'not yes = no');
  ok(evalExpr(notOf(bool(false))) === true, 'not no = yes');
  ok(typeOf(notOf(bool(true))) === 'boolean', 'not is boolean-typed');
  ok(evalExpr(notOf(notOf(bool(true)))) === true, 'not not yes = yes (it nests)');
  ok(UNARY_OPS.length === 1 && UNARY_OPS[0].op === 'not', 'not lives in its own registry');
  ok(UNARY_OPS[0].unary === true, 'flagged unary, so wrapNode builds a not - not a bin');
  ok(byOp['not'] === undefined, 'and is NOT in OPS - a bin always has two operands');
  ok(!('identity' in UNARY_OPS[0]), 'not has no identity - wrapping in it always changes the answer');

  console.log('T8: De Morgan holds - the grammar is internally consistent');
  [[true,true],[true,false],[false,true],[false,false]].forEach(([a, b]) => {
    const lhs = evalExpr(notOf(bin('and', bool(a), bool(b))));
    const rhs = evalExpr(bin('or', notOf(bool(a)), notOf(bool(b))));
    ok(lhs === rhs, 'not(' + boolWordJS(a) + ' and ' + boolWordJS(b) + ') = not-or-not');
  });

  console.log('T9: booleans compose with comparisons and sensors');
  state.ballX = 120;
  const compound = bin('and', cmp('>', v('ballX'), num(100)), cmp('<', v('ballX'), num(200)));
  ok(evalExpr(compound) === true, 'ballX(120) > 100 and ballX < 200');
  state.ballX = 400;
  ok(evalExpr(compound) === false, 'ballX(400) fails the upper bound');
  ok(evalExpr(notOf(compound)) === true, 'and not() inverts it');
  ok(typeOf(compound) === 'boolean', 'the compound is boolean-typed');
  state.ballX = 120;

  console.log('T10: and/or evaluate EAGERLY (no short-circuit) - deliberate');
  // the thought bubble prints both operands' values, so a half-evaluated
  // expression would show a number Beep never actually read
  let reads = 0;
  const counting = { type:'bool', get value(){ reads++; return true; } };
  evalExpr(bin('or', bool(true), counting));
  ok(reads === 1, 'the right operand of an `or` is read even when the left is yes');

  console.log('T11: FLIP pairs and/or, and stays involutive');
  ok(FLIP['and'] === 'or' && FLIP['or'] === 'and', 'and <-> or');
  ['+','-','*','/','and','or'].forEach(op => ok(FLIP[FLIP[op]] === op, op + ' flip is involutive'));
  ok(FLIP['not'] === undefined, 'not has no flip partner - it is unary');

  console.log('T12: a /0 hiding under a not or an and is still found');
  ok(L.dividesByZero(notOf(cmp('<', bin('/', num(1), num(0)), num(5)))),
     'the detector walks through a not');
  ok(L.dividesByZero(bin('and', bool(true), cmp('<', bin('/', num(1), num(0)), num(5)))),
     'and through an and');
  ok(!L.dividesByZero(notOf(bool(true))), 'a clean not stays clear');

  /* ------------------------------------------------------------------- the DOM */
  const paletteEl = document.getElementById('palette');
  const trayEl = document.getElementById('tray');
  const trashEl = document.getElementById('trash');
  setRect(trayEl, 600, 0, 200, 60);
  setRect(trashEl, 900, 0, 74, 60);

  console.log('T13: the shelf auto-derived the new tiles');
  ok(paletteEl.querySelectorAll('.pred.proto.bool').length === 2, 'two yes/no hexagons');
  const optiles = [...paletteEl.querySelectorAll('.optile.proto')];
  const glyphs = optiles.map(e => strip(e));
  ok(glyphs.indexOf('and') !== -1 && glyphs.indexOf('or') !== -1, 'and/or op tiles appeared');
  ok(glyphs.indexOf('not') !== -1, 'the not tile appeared too');
  ok(optiles.length === OPS.length + UNARY_OPS.length, 'one tile per registry entry');

  console.log('T14: an `and` tile WRAPS a sensor - the door comparisons could not use');
  const blocks = [...document.querySelectorAll('.block')];
  const ifBlock = blocks.find(b => /isKeyPressed/.test(b.textContent));
  await tap(safe(ifBlock).querySelector('.content') || NIL());
  const condEl = safe(ifBlock).querySelector('.pred[data-sl]');
  ok(!!condEl, 'the condition is a live slot holding a sensor');
  const andTile = optiles.find(e => strip(e) === 'and');
  await dragProto(andTile, 300, 300, condEl ? [condEl] : []);
  const grp = safe(ifBlock).querySelector('.group.boolgroup[data-sl]');
  ok(!!grp, 'the condition is now an and-group');
  ok(/yes$/.test(strip(grp)), 'seeded with the identity `yes`, got ' + strip(grp));
  ok(/isKeyPressed/.test(safe(grp).textContent), 'the original sensor survived as the left operand');
  ok(safe(grp).querySelectorAll('.pred.bool[data-sl]').length === 1, 'the fresh yes is a live slot');

  console.log('T15: the seeded identity means behaviour is UNCHANGED until tuned');
  // `X and yes` is X - that is the promise every wrap makes
  ok(AND(true, true) === true && AND(false, true) === false,
     'X and yes = X, so the wrap changed nothing yet');

  console.log('T16: tapping the fresh literal offers yes/no');
  const litEl = safe(grp).querySelector('.pred.bool[data-sl]');
  if (litEl) await tap(litEl);
  const boolBtns = popButtons().map(b => b.textContent);
  ok(boolBtns.indexOf('yes') !== -1 && boolBtns.indexOf('no') !== -1, 'both options offered');
  const noBtn = popButtons().find(b => b.textContent === 'no');
  clickBtn(noBtn);
  await sleep(20);
  ok(/no$/.test(strip(safe(ifBlock).querySelector('.group.boolgroup'))),
     'the literal is now `no`, got ' + strip(safe(ifBlock).querySelector('.group.boolgroup')));

  console.log('T17: the operator handle flips and <-> or');
  const grp2 = safe(ifBlock).querySelector('.group.boolgroup[data-sl]');
  const opEl = safe(grp2).querySelector('.op[data-op]');
  ok(strip(opEl) === 'and', 'the handle reads "and", got ' + strip(opEl));
  if (opEl) await tap(opEl);
  const flipBtn = popButtons().find(b => /make it or/.test(b.textContent));
  ok(!!flipBtn, 'the bin menu offers "make it or"');
  clickBtn(flipBtn);
  await sleep(20);
  ok(strip(safe(ifBlock).querySelector('.group.boolgroup .op[data-op]')) === 'or',
     'the operation is now `or`');

  console.log('T18: `not` wraps, and its handle can UNDO it');
  const grp3 = safe(ifBlock).querySelector('.group.boolgroup[data-sl]');
  const notTile = optiles.find(e => strip(e) === 'not');
  const innerBefore = strip(grp3);
  await dragProto(notTile, 300, 300, grp3 ? [grp3] : []);
  const outer = safe(ifBlock).querySelector('.group.boolgroup[data-sl]');
  ok(/^not/.test(strip(outer)), 'the group is now wrapped in a not, got ' + strip(outer));
  const notOp = safe(outer).querySelector('.op[data-op]');
  ok(strip(notOp) === 'not', 'the outermost handle reads "not"');
  if (notOp) await tap(notOp);
  const removeBtn = popButtons().find(b => /remove the not/.test(b.textContent));
  ok(!!removeBtn, 'its menu offers "remove the not" - the wrap is not a one-way door');
  clickBtn(removeBtn);
  await sleep(20);
  const after = strip(safe(ifBlock).querySelector('.group.boolgroup[data-sl]'));
  ok(after === innerBefore, 'removing it restored the original, got ' + after);

  console.log('T18b: "not" is offered in the CHOOSER too, not only as a tile');
  // this also proves expectedType types a bin's operands by its OPERATION:
  // opsFor computes outT = expectedType(slot), so if an `and` operand were still
  // typed 'number' the boolean wrap options would vanish entirely
  const lit = safe(ifBlock).querySelector('.pred.bool[data-sl]');
  if (lit) await tap(lit);
  const wrapOpts = popButtons().map(b => b.textContent);
  ok(wrapOpts.indexOf('not') !== -1,
     'a boolean piece is offered "wrap in not", got [' + wrapOpts.join(' | ') + ']');
  ok(wrapOpts.some(t => /^and yes$/.test(t)),
     'and "and yes" - the identity is spelled out, so the no-op promise is visible');
  ok(!wrapOpts.some(t => /^\+ 0$/.test(t)), 'but never "+ 0" - it is a boolean');
  clickBtn(popButtons().find(b => b.textContent === 'not'));
  await sleep(20);
  ok(/not/.test(strip(safe(ifBlock).querySelector('.group.boolgroup'))),
     'clicking it wrapped the literal in a not, got ' + strip(safe(ifBlock).querySelector('.group.boolgroup')));

  console.log('T19: the type gate keeps the two worlds apart');
  // an `and` tile must NOT be offered on a number, and `+` must not be offered
  // on a boolean - opsFor is the two-sided filter that enforces it
  const numSlotBlock = [...document.querySelectorAll('.block')]
    .find(b => /ballY =/.test(b.textContent.replace(/\s+/g, ' ')));
  await tap(safe(numSlotBlock).querySelector('.content') || NIL());
  const numTok = safe(numSlotBlock).querySelector('.token[data-sl]');
  if (numTok) await tap(numTok);
  const numWraps = popButtons().map(b => b.textContent);
  ok(numWraps.some(t => /^\+ 0$/.test(t)), 'a number is offered "wrap in +"');
  ok(!numWraps.some(t => /^and |^or |^not$/.test(t)),
     'but never and/or/not - those want booleans');
  document.dispatchEvent(pev('pointerdown', 1, 1));
  await sleep(20);

  console.log('T20: Reset restores a condition rebuilt with and/or');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  ok(!document.querySelector('.block .group.boolgroup'), 'the and-group is gone');
  ok(/isKeyPressed/.test(document.body.textContent), 'the seed sensors are back');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();

function boolWordJS(b){ return b ? 'yes' : 'no'; }
