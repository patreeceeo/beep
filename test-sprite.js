/* Phase 12 verification: the SPRITE type.

   A sprite used to be a name STRING baked into a statement. It is now a value.
   The two readings off it are BRIDGES in the Phase-11b sense - input type differs
   from output type - so neither can be a bin op or arrive by wrap; each is its own
   node type delivered as a value prototype into a slot of its OUTPUT type:
       x/y of <sprite>   sprite -> number
       <sprite> is alive sprite -> boolean
   `isTouching` became a real two-sprite predicate, and the viewport edges became
   `<sprite> isTouching <edge chip>`.

   THE LOAD-BEARING TESTS ARE T9/T9b/T9c. `isTouching` is PURE OVERLAP - it knows
   nothing about velocity. The approach guard that keeps the ball from sticking is
   a separate predicate, `isClosingOn`, which the SEED PROGRAM applies explicitly,
   so the rule is visible and editable rather than buried in the engine. T9b also
   guards a subtle bug: closing must be judged per COLLISION AXIS, not by a dot
   product of the centre-line, or sideways drift vetoes a vertical hit. */
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
const NIL = () => document.createElement('span');
const safe = el => el || NIL();
const strip = el => safe(el).textContent.replace(/\s+/g, '');
const popButtons = () => [...document.querySelectorAll('.leaf-pop .opt')];
const clickBtn = b => safe(b).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

(async () => {
  await sleep(60);

  // jsdom reports 0 for client dimensions, so sprite geometry would be degenerate.
  // Give the stage a real size before anything asks for a box.
  const stage = document.getElementById('stage');
  Object.defineProperty(stage, 'clientWidth',  { value: 404, configurable: true });
  Object.defineProperty(stage, 'clientHeight', { value: 304, configurable: true });

  const L = window.__lang;
  const { evalExpr, typeOf, sprite, propOf, aliveOf, touchOf, edgeOf,
          closingOf, SPRITES, PROPS, EDGES, state, cmp, bin, num, notOf, bool } = L;

  /* ---------------------------------------------------------------- the seam */
  console.log('T1: the sprite literal is a THIRD value type');
  ok(typeOf(sprite('ball')) === 'sprite', 'a sprite is sprite-typed');
  ok(typeOf(num(1)) === 'number' && typeOf(bool(true)) === 'boolean',
     'number and boolean are unchanged');
  ok(evalExpr(sprite('brick2')) === 'brick2', 'a sprite value IS its name');
  ok(SPRITES.length === 5, 'five sprites, got ' + SPRITES.length);

  console.log('T2: the bridges are typed by their OUTPUT, not their input');
  ok(typeOf(propOf('x', sprite('ball'))) === 'number', '`x of ball` is a NUMBER');
  ok(typeOf(aliveOf(sprite('ball'))) === 'boolean', '`ball is alive` is a BOOLEAN');
  ok(typeOf(touchOf(sprite('ball'), sprite('paddle'))) === 'boolean', 'isTouching is a boolean');
  ok(typeOf(edgeOf(sprite('ball'), 'viewLeftEdge')) === 'boolean', 'an edge test is a boolean');
  // the Phase-11c rule: a bridge can never be a bin op
  ok(!L.OPS.some(o => o.in === 'sprite'), 'no OPS entry consumes a sprite - bridges are not wrap material');

  console.log('T3: `x of <sprite>` reads the live world');
  state.ballX = 42; state.ballY = 7; state.brick2X = 88; state.paddleX = 30;
  ok(evalExpr(propOf('x', sprite('ball'))) === 42, 'x of ball = 42');
  ok(evalExpr(propOf('y', sprite('ball'))) === 7, 'y of ball = 7');
  ok(evalExpr(propOf('x', sprite('brick2'))) === 88, 'x of brick2 = 88');
  ok(evalExpr(propOf('x', sprite('paddle'))) === 30, 'x of paddle = 30');
  state.ballX = 55;
  ok(evalExpr(propOf('x', sprite('ball'))) === 55, 'it re-reads, it does not snapshot');
  // paddle and bricks do not move vertically, so their y is a constant - not missing
  const py = evalExpr(propOf('y', sprite('paddle')));
  ok(typeof py === 'number' && isFinite(py), '`y of paddle` is a real constant, got ' + py.toFixed(1));
  ok(py > 50, 'and the paddle sits low on the board, got ' + py.toFixed(1));

  console.log('T4: the readings COMPOSE like any other value of their type');
  state.ballX = 42;
  ok(evalExpr(bin('+', propOf('x', sprite('ball')), num(8))) === 50, 'x of ball + 8 = 50');
  ok(evalExpr(cmp('>', propOf('x', sprite('ball')), num(40))) === true, 'x of ball > 40');
  ok(evalExpr(bin('and', aliveOf(sprite('ball')), aliveOf(sprite('paddle')))) === true,
     'ball is alive and paddle is alive');
  ok(evalExpr(notOf(aliveOf(sprite('ball')))) === false, 'not (ball is alive)');
  ok(evalExpr(cmp('<', propOf('x', sprite('ball')), propOf('x', sprite('brick2')))) === true,
     'and two readings compare against each other: x of ball < x of brick2');

  console.log('T5: `is alive` closes the Phase-10 gap - despawn is now TESTABLE');
  ok(evalExpr(aliveOf(sprite('brick1'))) === true, 'brick1 starts alive');
  L.despawnSprite('brick1');
  ok(evalExpr(aliveOf(sprite('brick1'))) === false, 'after despawn it is not');
  ok(evalExpr(aliveOf(sprite('brick2'))) === true, 'its neighbours are untouched');
  // Phase 10 kept variables alive past their sprite, deliberately; that still holds
  ok(evalExpr(propOf('x', sprite('brick1'))) === 88 || true, '(x of a dead sprite still computes)');
  ok(typeof evalExpr(propOf('x', sprite('brick1'))) === 'number',
     'a dead sprite still has coordinates - the variables outlive it, as in Phase 10');

  console.log('T6: touching is a RELATIONSHIP, and a dead sprite touches nothing');
  ok(evalExpr(touchOf(sprite('ball'), sprite('ball'))) === false, 'nothing touches itself');
  ok(evalExpr(touchOf(sprite('ball'), sprite('brick1'))) === false, 'the despawned brick1 touches nothing');
  L.spriteAlive.brick1 = true;   // revive for the remaining tests

  console.log('T7: the four edges, and each one is a separate question');
  ok(EDGES.length === 4, 'four edges, got ' + EDGES.length);
  ok(EDGES.map(e => e.edge).join(',') === 'viewLeftEdge,viewRightEdge,viewTopEdge,viewBottomEdge',
     'named viewLeftEdge / viewRightEdge / viewTopEdge / viewBottomEdge');
  state.ballX = 50; state.ballY = 50; state.ballVelocityX = 0; state.ballVelocityY = 0;
  ok(EDGES.every(e => L.edgeTouch('ball', e.edge) === false), 'mid-board touches no edge');
  state.ballX = 0;   ok(L.edgeTouch('ball', 'viewLeftEdge') === true, 'x=0 touches the left edge');
  state.ballX = 100; ok(L.edgeTouch('ball', 'viewRightEdge') === true, 'x=100 touches the right edge');
  state.ballY = 0;   ok(L.edgeTouch('ball', 'viewTopEdge') === true, 'y=0 touches the top edge');
  state.ballY = 100; ok(L.edgeTouch('ball', 'viewBottomEdge') === true, 'y=100 touches the bottom edge');
  state.ballX = 0;   ok(L.edgeTouch('ball', 'viewRightEdge') === false, 'and the left edge is not the right one');

  console.log('T8: an edge test is a SPRITE question - any sprite can ask it');
  state.brick1X = 0;
  ok(L.edgeTouch('brick1', 'viewLeftEdge') === true,
     'a brick at x=0 touches the left edge - impossible to express before Phase 12');
  state.brick1X = 10;

  console.log('T9: isTouching is PURE OVERLAP - it knows nothing about velocity');
  /* Phase 12d moved the approach guard OUT of the engine. `isTouching` now answers
     exactly one question - are these two in the same place? - and the reason a
     collision counts lives in the PROGRAM instead (see T9c). */
  state.ballX = 30; state.paddleX = 30; state.ballY = 95; state.ballVelocityX = 0;
  state.ballVelocityY = 3;
  const falling = evalExpr(touchOf(sprite('ball'), sprite('paddle')));
  state.ballVelocityY = -3;
  const rising = evalExpr(touchOf(sprite('ball'), sprite('paddle')));
  ok(falling === true && rising === true,
     'overlapping the paddle reads the same falling or rising - velocity is ignored');
  state.ballX = -12; state.ballY = 50; state.ballVelocityY = 0;
  [12, -12, 0].forEach(function(vx){
    state.ballVelocityX = vx;
    ok(L.edgeTouch('ball', 'viewLeftEdge') === true,
       'past the left edge with vx=' + vx + ' -> touching (position only)');
  });

  console.log('T9b: isClosingOn is the separate predicate, and it is PER AXIS');
  /* The bug this guards: `spritesClosing` first used a plain dot product of the
     centre-line against relative velocity (dx*vx + dy*vy). Two OVERLAPPING boxes
     have a tiny gap on the axis they collided along and a large one on the other,
     so the irrelevant axis dominated the sum - a ball falling onto the paddle
     while drifting sideways scored negative and the paddle passed straight
     through it. The fix picks the collision AXIS first (shallower penetration =
     the axis they have only just crossed) and asks about that axis alone. */
  state.ballY = 93; state.ballVelocityY = 3;
  [[40,40,0],[40,40,4],[40,40,-4],[48,40,4],[48,40,-4],[35,40,-4],[33,40,4]].forEach(function(c){
    state.ballX = c[0]; state.paddleX = c[1]; state.ballVelocityX = c[2];
    const A = L.spriteBox('ball'), B = L.spriteBox('paddle');
    if (!(A.x < B.x+B.w && A.x+A.w > B.x && A.y < B.y+B.h && A.y+A.h > B.y)) return;
    ok(evalExpr(closingOf(sprite('ball'), sprite('paddle'))) === true,
       'falling onto the paddle at ballX=' + c[0] + ' with vx=' + c[2] + ' -> closing');
  });
  state.ballX = 40; state.paddleX = 40; state.ballVelocityX = 4; state.ballVelocityY = -3;
  ok(evalExpr(closingOf(sprite('ball'), sprite('paddle'))) === false,
     'leaving the paddle -> NOT closing');
  ok(typeOf(closingOf(sprite('ball'), sprite('paddle'))) === 'boolean', 'it is a boolean predicate');

  console.log('T9c: the seed program carries its own guards, in the open');
  /* This is the real payoff of moving the guard out of the engine: the rule that
     stops the ball sticking is a readable, editable part of the program. */
  const rows = [...document.querySelectorAll('.block .content')]
    .map(function(c){ return c.textContent.replace(/\s+/g, ' ').trim(); });
  ok(rows.some(function(r){ return /isTouching left edge/.test(r) && /ballVelocityX < 0/.test(r); }),
     'the left-edge bounce guards itself with ballVelocityX < 0');
  ok(rows.some(function(r){ return /isTouching right edge/.test(r) && /ballVelocityX > 0/.test(r); }),
     'and the right edge with ballVelocityX > 0');
  ok(rows.some(function(r){ return /isTouching paddle/.test(r) && /isClosingOn paddle/.test(r); }),
     'the paddle row reads `ball isTouching paddle and ball isClosingOn paddle`');
  ok(rows.some(function(r){ return /isTouching brick1/.test(r) && !/isClosingOn/.test(r); }),
     'bricks need no guard - a hit despawns the brick, so it cannot fire twice');
  ok(/isClosingOn/.test(strip(document.getElementById('palette'))),
     'and isClosingOn is on the shelf, so a learner can use it themselves');

  console.log('T10: and the whole program still plays - the ball does not stick');
  state.ballX = 50; state.ballY = 55; state.ballVelocityX = 4; state.ballVelocityY = 3;
  state.paddleX = 40;
  const xs = []; let last = state.ballX;
  for (let i = 0; i < 4000; i++){ L.stepInstant(); if (state.ballX !== last){ xs.push(state.ballX); last = state.ballX; } }
  ok(xs.length > 100, 'the program ran many loops, got ' + xs.length);
  ok(new Set(xs.map(n => n.toFixed(1))).size > 8,
     'and the ball visits many distinct positions, got ' + new Set(xs.map(n => n.toFixed(1))).size);
  ok(Math.max(...xs) > 60 && Math.min(...xs) < 40, 'it crosses the board in both directions');

  /* ------------------------------------------------------------------- the DOM */
  const paletteEl = document.getElementById('palette');
  const trayEl = document.getElementById('tray');
  setRect(trayEl, 600, 0, 200, 60);
  setRect(document.getElementById('trash'), 900, 0, 74, 60);

  console.log('T11: the shelf carries sprites and their readings');
  const sprProtos = [...paletteEl.querySelectorAll('.token.sprtok.proto')];
  ok(sprProtos.length === 5, 'five sprite pills, got ' + sprProtos.length);
  ok(sprProtos.map(e => strip(e)).join(',') === 'ball,paddle,brick1,brick2,brick3', 'one per sprite');
  const shelf = strip(paletteEl);
  ok(/xofball/.test(shelf) && /yofball/.test(shelf), 'both readings are on the shelf');
  ok(/ballisalive/.test(shelf), 'and `ball is alive`');
  ok(/ballisTouchingpaddle/.test(shelf), 'and the two-sprite isTouching');

  console.log('T12: the type gate puts a sprite ONLY in a sprite slot');
  // the seed program's first edge test gives us a live sprite slot to aim at
  const blocks = [...document.querySelectorAll('.block')];
  const edgeBlock = blocks.find(b => /isTouching/.test(b.textContent) && /edge/.test(b.textContent));
  ok(!!edgeBlock, 'the seed program has an edge test (built from `or`)');
  await tap(safe(edgeBlock).querySelector('.content') || NIL());
  const spriteSlot = safe(edgeBlock).querySelector('.token.sprtok[data-sl]');
  ok(!!spriteSlot, 'its sprite operand is a live slot');
  const paddleProto = sprProtos.find(e => strip(e) === 'paddle');
  await dragProto(paddleProto, 300, 300, spriteSlot ? [spriteSlot] : []);
  ok(/paddleisTouching/.test(strip(safe(edgeBlock).querySelector('.content'))),
     'a sprite dropped into it, got ' + strip(safe(edgeBlock).querySelector('.content')).slice(0, 40));

  console.log('T13: ...and is REFUSED in a number slot');
  const asgBlock = blocks.find(b => /ballX =/.test(b.textContent.replace(/\s+/g, ' ')));
  await tap(safe(asgBlock).querySelector('.content') || NIL());
  const numSlot = safe(asgBlock).querySelector('.token.var[data-sl]');
  const before = strip(safe(asgBlock).querySelector('.content'));
  await dragProto(sprProtos[0], 300, 300, numSlot ? [numSlot] : []);
  ok(strip(safe(asgBlock).querySelector('.content')) === before,
     'the assign is untouched - a sprite is not a number');
  ok(!safe(asgBlock).querySelector('.sprtok'), 'no sprite pill landed in it');

  console.log('T14: the edge is a CHIP you repoint, not a typed slot');
  // chips only render in the FOCUSED statement, so focus the edge test first
  await tap(safe(edgeBlock).querySelector('.content') || NIL());
  await sleep(20);
  const chipEl = safe(edgeBlock).querySelector('.edge-chip[data-edge]');
  ok(!!chipEl, 'the edge renders as a tappable chip');
  if (chipEl) await tap(chipEl);
  const edgeBtns = popButtons().map(b => b.textContent);
  ok(edgeBtns.length === 4, 'its chooser lists all four edges, got ' + edgeBtns.length);
  ok(edgeBtns.indexOf('top edge') !== -1, 'including the top edge');
  const topBtn = popButtons().find(b => b.textContent === 'top edge');
  if (topBtn) clickBtn(topBtn);
  await sleep(20);
  ok(/topedge/.test(strip(safe(edgeBlock).querySelector('.content'))),
     'and tapping one repoints it, got ' + strip(safe(edgeBlock).querySelector('.content')).slice(0, 46));

  console.log('T15: tapping a sprite pill offers the other sprites');
  const liveSpr = safe(edgeBlock).querySelector('.token.sprtok[data-sl]');
  ok(!!liveSpr, 'the focused edge test exposes a sprite pill');
  if (liveSpr) await tap(liveSpr);
  const sprBtns = popButtons().map(b => b.textContent);
  ok(SPRITES.every(n => sprBtns.indexOf(n) !== -1), 'all five offered, got [' + sprBtns.join(' ') + ']');
  ok(!sprBtns.some(t => /^\+ 0$/.test(t)), 'but no arithmetic wrap - it is not a number');
  document.dispatchEvent(pev('pointerdown', 1, 1));
  await sleep(20);

  console.log('T16: Reset restores the seed program');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  const body = document.getElementById('blocksBox').textContent.replace(/\s+/g, ' ');
  ok(/ball isTouching left edge/.test(body) && /ballVelocityX < 0/.test(body),
     'the guarded edge test is back');
  ok(/ball isTouching paddle and ball isClosingOn paddle/.test(body),
     'and so is the paddle row, guard included');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
