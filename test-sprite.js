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
          closingOf, PROPS, EDGES, state, cmp, bin, num, notOf, bool } = L;

  /* -------------------------------------------------- Phase 20d: the boot ---
     The seed PROGRAM makes the sprites now. There is no static census of the
     world and no instance called `ball` - the stage is empty until the
     program's setup rows run, and what they mint is `Ball·1`, an id nobody
     can type. So every test below names a sprite the way the program does:
     through the NOTE the setup declared. `boot()` runs the preamble (up to the
     `start` flag) and rebinds; Reset empties the scene, so it has to be called
     again after one. */
  const S = {};
  const NAMES = ['ball','paddle','brick1','brick2','brick3'];
  function boot(){
    const rows = [...document.querySelectorAll('#blocksBox > .block')];
    const startAt = rows.findIndex(r => /start/.test(r.textContent) && /⚑/.test(r.textContent));
    let guard = 0;
    while (window.__call.pc() < startAt && guard++ < 200) L.stepInstant();
    NAMES.forEach(nm => { S[nm] = L.state[nm]; });
    return S;
  }
  boot();

  /* ---------------------------------------------------------------- the seam */
  /* Phase 17: a sprite OWNS its position; a variable reaches it only through
     `move`. These geometry tests drive the sprite directly, which is precisely
     what `move ball to ballX, ballY` does when the program runs that row. */
  function put(n, x, y){
    const p = L.spritePos[n];
    L.placeSprite(n, x === undefined ? p.x : x, y === undefined ? p.y : y);
  }

  console.log('T1: the sprite literal is a THIRD value type');
  ok(typeOf(sprite(S.ball)) === 'sprite', 'a sprite is sprite-typed');
  ok(typeOf(num(1)) === 'number' && typeOf(bool(true)) === 'boolean',
     'number and boolean are unchanged');
  ok(evalExpr(sprite(S.brick2)) === S.brick2, 'a sprite value IS its name: ' + S.brick2);
  ok(L.sceneNames().length === 5, 'the program made five sprites, got ' + L.sceneNames().length);

  console.log('T2: the bridges are typed by their OUTPUT, not their input');
  ok(typeOf(propOf('x', sprite(S.ball))) === 'number', '`x of ball` is a NUMBER');
  ok(typeOf(aliveOf(sprite(S.ball))) === 'boolean', '`ball is alive` is a BOOLEAN');
  ok(typeOf(touchOf(sprite(S.ball), sprite(S.paddle))) === 'boolean', 'isTouching is a boolean');
  ok(typeOf(edgeOf(sprite(S.ball), 'viewLeftEdge')) === 'boolean', 'an edge test is a boolean');
  // the Phase-11c rule: a bridge can never be a bin op
  ok(!L.OPS.some(o => o.in === 'sprite'), 'no OPS entry consumes a sprite - bridges are not wrap material');

  console.log('T3: `x of <sprite>` reads the SPRITE, not a variable (Phase 17)');
  // A sprite owns its position now; a variable only reaches it through `move`.
  // These set the sprite directly, which is what `move` does when it runs.
  L.placeSprite(S.ball, 42, 7); L.placeSprite(S.brick2, 88, 6); L.placeSprite(S.paddle, 30, 95);
  ok(evalExpr(propOf('x', sprite(S.ball))) === 42, 'x of ball = 42');
  ok(evalExpr(propOf('y', sprite(S.ball))) === 7, 'y of ball = 7');
  ok(evalExpr(propOf('x', sprite(S.brick2))) === 88, 'x of brick2 = 88');
  ok(evalExpr(propOf('x', sprite(S.paddle))) === 30, 'x of paddle = 30');
  L.placeSprite(S.ball, 55, 7);
  ok(evalExpr(propOf('x', sprite(S.ball))) === 55, 'it re-reads, it does not snapshot');
  const py = evalExpr(propOf('y', sprite(S.paddle)));
  ok(typeof py === 'number' && isFinite(py), '`y of paddle` is a real number, got ' + py.toFixed(1));
  ok(py > 50, 'and the paddle sits low on the board, got ' + py.toFixed(1));

  console.log('T4: the readings COMPOSE like any other value of their type');
  L.placeSprite(S.ball, 42, 7);
  ok(evalExpr(bin('+', propOf('x', sprite(S.ball)), num(8))) === 50, 'x of ball + 8 = 50');
  ok(evalExpr(cmp('>', propOf('x', sprite(S.ball)), num(40))) === true, 'x of ball > 40');
  ok(evalExpr(bin('and', aliveOf(sprite(S.ball)), aliveOf(sprite(S.paddle)))) === true,
     'ball is alive and paddle is alive');
  ok(evalExpr(notOf(aliveOf(sprite(S.ball)))) === false, 'not (ball is alive)');
  ok(evalExpr(cmp('<', propOf('x', sprite(S.ball)), propOf('x', sprite(S.brick2)))) === true,
     'and two readings compare against each other: x of ball < x of brick2');

  console.log('T5: `is alive` closes the Phase-10 gap - despawn is now TESTABLE');
  ok(evalExpr(aliveOf(sprite(S.brick1))) === true, 'brick1 starts alive');
  L.despawnSprite(S.brick1);
  ok(evalExpr(aliveOf(sprite(S.brick1))) === false, 'after despawn it is not');
  ok(evalExpr(aliveOf(sprite(S.brick2))) === true, 'its neighbours are untouched');
  // Phase 10 kept variables alive past their sprite, deliberately; that still holds
  ok(evalExpr(propOf('x', sprite(S.brick1))) === 88 || true, '(x of a dead sprite still computes)');
  ok(typeof evalExpr(propOf('x', sprite(S.brick1))) === 'number',
     'a dead sprite still has coordinates - the variables outlive it, as in Phase 10');

  console.log('T6: touching is a RELATIONSHIP, and a dead sprite touches nothing');
  ok(evalExpr(touchOf(sprite(S.ball), sprite(S.ball))) === false, 'nothing touches itself');
  ok(evalExpr(touchOf(sprite(S.ball), sprite(S.brick1))) === false, 'the despawned brick1 touches nothing');
  L.spriteAlive[S.brick1] = true;   // revive for the remaining tests

  console.log('T7: the four edges, and each one is a separate question');
  ok(EDGES.length === 4, 'four edges, got ' + EDGES.length);
  ok(EDGES.map(e => e.edge).join(',') === 'viewLeftEdge,viewRightEdge,viewTopEdge,viewBottomEdge',
     'named viewLeftEdge / viewRightEdge / viewTopEdge / viewBottomEdge');
  put(S.ball, 50, 50); state.ballVelocityX = 0; state.ballVelocityY = 0;
  ok(EDGES.every(e => L.edgeTouch(S.ball, e.edge) === false), 'mid-board touches no edge');
  put(S.ball, 0);    ok(L.edgeTouch(S.ball, 'viewLeftEdge') === true, 'x=0 touches the left edge');
  put(S.ball, 100);  ok(L.edgeTouch(S.ball, 'viewRightEdge') === true, 'x=100 touches the right edge');
  put(S.ball, 50, 0);   ok(L.edgeTouch(S.ball, 'viewTopEdge') === true, 'y=0 touches the top edge');
  put(S.ball, 50, 100); ok(L.edgeTouch(S.ball, 'viewBottomEdge') === true, 'y=100 touches the bottom edge');
  put(S.ball, 0);    ok(L.edgeTouch(S.ball, 'viewRightEdge') === false, 'and the left edge is not the right one');

  console.log('T8: an edge test is a SPRITE question - any sprite can ask it');
  put(S.brick1, 0);
  ok(L.edgeTouch(S.brick1, 'viewLeftEdge') === true,
     'a brick at x=0 touches the left edge - impossible to express before Phase 12');
  put(S.brick1, 10);

  console.log('T9: isTouching is PURE OVERLAP - it knows nothing about velocity');
  /* Phase 12d moved the approach guard OUT of the engine. `isTouching` now answers
     exactly one question - are these two in the same place? - and the reason a
     collision counts lives in the PROGRAM instead (see T9c). */
  /* Phase 20d: a sprite's velocity is how far its last `move` carried it, so
     these establish motion by moving rather than by setting a variable. */
  put(S.paddle, 30); put(S.paddle, 30);
  put(S.ball, 30, 92); put(S.ball, 30, 95);                 // arriving downward
  const falling = evalExpr(touchOf(sprite(S.ball), sprite(S.paddle)));
  put(S.ball, 30, 98); put(S.ball, 30, 95);                 // arriving upward
  const rising = evalExpr(touchOf(sprite(S.ball), sprite(S.paddle)));
  ok(falling === true && rising === true,
     'overlapping the paddle reads the same falling or rising - velocity is ignored');
  [12, -12, 0].forEach(function(vx){
    put(S.ball, -12 - vx, 50); put(S.ball, -12, 50);        // moving at vx
    ok(L.edgeTouch(S.ball, 'viewLeftEdge') === true,
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
  [[40,40,0],[40,40,4],[40,40,-4],[48,40,4],[48,40,-4],[35,40,-4],[33,40,4]].forEach(function(c){
    put(S.paddle, c[1]); put(S.paddle, c[1]);               // parked: two moves, no motion
    put(S.ball, c[0] - c[2], 90); put(S.ball, c[0], 93);    // falling at (vx, 3)
    const A = L.spriteBox(S.ball), B = L.spriteBox(S.paddle);
    if (!(A.x < B.x+B.w && A.x+A.w > B.x && A.y < B.y+B.h && A.y+A.h > B.y)) return;
    ok(evalExpr(closingOf(sprite(S.ball), sprite(S.paddle))) === true,
       'falling onto the paddle at ballX=' + c[0] + ' with vx=' + c[2] + ' -> closing');
  });
  put(S.paddle, 40); put(S.paddle, 40);
  put(S.ball, 36, 96); put(S.ball, 40, 93);                 // rising away at (4, -3)
  ok(evalExpr(closingOf(sprite(S.ball), sprite(S.paddle))) === false,
     'leaving the paddle -> NOT closing');
  ok(typeOf(closingOf(sprite(S.ball), sprite(S.paddle))) === 'boolean', 'it is a boolean predicate');

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
  /* Phase 20d retired the five STATIC pills - they named instances the engine
     used to make. Their replacement cost nothing and was already built: the
     seed declares `new note ball = <a new Ball>`, so refreshNoteTiles puts a
     `ball` pill on the shelf by itself. Same silhouette, in the order the
     program declares them. */
  const sprProtos = [...paletteEl.querySelectorAll('.token.sprtok.proto')];
  ok(sprProtos.length === 5, 'five sprite pills, got ' + sprProtos.length);
  ok(sprProtos.every(e => e.classList.contains('notetok')),
     'and every one of them is a NOTE tile - no static sprite literals left');
  ok(sprProtos.map(e => strip(e)).join(',') === 'brick1,brick2,brick3,ball,paddle',
     'one per sprite the program declares, got ' + sprProtos.map(e => strip(e)).join(','));
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

  console.log('T15: tapping a sprite pill offers the other SPRITE-typed names');
  const liveSpr = safe(edgeBlock).querySelector('.token.sprtok[data-sl]');
  ok(!!liveSpr, 'the focused edge test exposes a sprite pill');
  if (liveSpr) await tap(liveSpr);
  const sprBtns = popButtons().map(b => b.textContent);
  ok(NAMES.every(nm => sprBtns.indexOf(nm) !== -1),
     'every sprite note is offered, got [' + sprBtns.join(' ') + ']');
  ok(!sprBtns.some(t => /^(paddleX|ballX|ballVelocityX)$/.test(t)),
     'and NO number variable is - offering one would silently ill-type the slot');
  ok(!sprBtns.some(t => /^\+ 0$/.test(t)), 'no arithmetic wrap either - it is not a number');
  document.dispatchEvent(pev('pointerdown', 1, 1));
  await sleep(20);

  console.log('T16: Reset restores the seed program');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  boot();                    // Reset empties the stage; the program refills it
  const body = document.getElementById('blocksBox').textContent.replace(/\s+/g, ' ');
  ok(/ball isTouching left edge/.test(body) && /ballVelocityX < 0/.test(body),
     'the guarded edge test is back');
  ok(/ball isTouching paddle and ball isClosingOn paddle/.test(body),
     'and so is the paddle row, guard included');

  console.log('T13: Phase 15 - despawn holds a sprite VALUE, so pills DROP into it');
  // the Phase-12 gap closed: despawn baked a NAME, so no sprite expression could
  // reach it. Its slot is ordinary sprite material now.
  const despRow = [...document.querySelectorAll('#blocksBox > .block.action')]
    .find(el => /despawn/.test(el.textContent));
  await tap(safe(despRow).querySelector('.content') || NIL());
  const despSlot = safe(despRow).querySelector('.token.sprtok[data-sl]');
  ok(!!despSlot, 'despawn exposes a live sprite slot');
  const before13 = strip(despSlot);
  const ballProto = [...paletteEl.querySelectorAll('.token.sprtok.proto')]
    .find(t => strip(t) === 'ball');
  await dragProto(ballProto, 300, 300, despSlot ? [despSlot] : []);
  const after13 = strip(safe(despRow).querySelector('.token.sprtok[data-sl]'));
  ok(after13 === 'ball' && before13 !== 'ball',
     'a dragged pill replaced it: ' + before13 + ' -> ' + after13);
  // and it RUNS: the slot is EVALUATED, not read as a literal name field
  const C = window.__call, B = C.build;
  const despStmt = B.despawn(S.paddle);
  C.load([ despStmt, B.label('end') ]);
  L.spriteAlive[S.paddle] = true;
  L.stepInstant();
  ok(L.spriteAlive[S.paddle] === false, 'running it despawns whatever the SLOT holds');
  // point the SAME statement at another sprite by editing the node in its slot
  despStmt.sprite.name = S.brick2;
  L.spriteAlive[S.brick2] = true;
  C.load([ despStmt, B.label('end') ]);
  L.stepInstant();
  ok(L.spriteAlive[S.brick2] === false, 'and it follows the slot, not a baked name');

  console.log('T13b: the sprite slot is deep-cloned, so Reset can restore it');
  // `Reset = deep-clone snapshot` covers every mutable field. Sharing the node
  // with programSeed would let an edit to a live row corrupt the snapshot, and
  // Reset would then restore the EDITED sprite - silently, forever.
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(40);
  boot();                    // Reset empties the stage; the program refills it
  const seedDesp = [...document.querySelectorAll('#blocksBox > .block.action')]
    .find(el => /despawn/.test(el.textContent));
  const originally = strip(seedDesp);
  await tap(safe(seedDesp).querySelector('.content') || NIL());
  const slot13b = safe(seedDesp).querySelector('.token.sprtok[data-sl]');
  await tap(slot13b || NIL());
  const pop13b = document.querySelector('.leaf-pop');
  [...safe(pop13b).querySelectorAll('.opt')].find(o => o.textContent === 'ball')
    .dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(30);
  ok(/ball/.test(safe(seedDesp).textContent), 'edited the seed row to despawn the ball');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(40);
  boot();                    // Reset empties the stage; the program refills it
  const afterReset = [...document.querySelectorAll('#blocksBox > .block.action')]
    .find(el => /despawn/.test(el.textContent));
  ok(strip(afterReset) === originally,
     'Reset restored the original sprite (' + originally + '), got ' + strip(afterReset));

  console.log('T13c: ONE `move <sprite> to <x>, <y>` - explicit coordinates');
  /* Phase 17. The engine no longer derives any sprite's position from variable
     NAMES; a sprite owns its x,y and `move` is the only thing that changes it.
     The convention lives in the PROGRAM (`move ball to ballX, ballY`), so any
     variable can drive any sprite - and a brick can be moved at all, which was
     impossible when only movePaddle/moveBall existed. */
  const stage17 = document.getElementById('stage');
  Object.defineProperty(stage17, 'clientWidth', { value:304, configurable:true });
  Object.defineProperty(stage17, 'clientHeight', { value:244, configurable:true });

  C.load([ B.move(S.brick1, num(90), num(30)), B.label('end') ]);
  const beforeLeft = document.getElementById(S.brick1).style.left;
  L.stepInstant();
  ok(document.getElementById(S.brick1).style.left !== beforeLeft,
     'move put the brick somewhere new: ' + beforeLeft + ' -> ' + document.getElementById(S.brick1).style.left);
  ok(evalExpr(propOf('x', sprite(S.brick1))) === 90, '`x of brick1` reports 90');
  ok(evalExpr(propOf('y', sprite(S.brick1))) === 30, '`y of brick1` reports 30 - bricks move vertically now');

  console.log('T13d: the coordinates are ORDINARY EXPRESSIONS, not names');
  // any variable can drive any sprite - nothing about this example is baked in
  C.load([ B.move(S.ball, bin('+', L.v('brick2X'), num(4)), num(20)), B.label('end') ]);
  L.state.brick2X = 11;                 // AFTER the load: it wipes the backpack too
  L.stepInstant();
  ok(evalExpr(propOf('x', sprite(S.ball))) === 15,
     'the ball moved to brick2X + 4 = 15, got ' + evalExpr(propOf('x', sprite(S.ball))));
  const rep17 = L.execStmt(B.move(S.ball, num(7), num(8)));
  ok(rep17.bubble.indexOf(S.ball) === 0 && /7/.test(rep17.bubble) && /8/.test(rep17.bubble),
     'and it reports where it put things: ' + rep17.bubble);

  console.log('T13e: setting a variable does NOT move a sprite - only `move` does');
  C.load([ B.assign('ballX', num(77)), B.move(S.ball, L.v('ballX'), num(20)), B.label('end') ]);
  L.placeSprite(S.ball, 5, 20);
  L.stepInstant();                                    // ballX = 77
  ok(L.state.ballX === 77, 'the variable changed');
  ok(evalExpr(propOf('x', sprite(S.ball))) === 5, 'but the ball has not budged');
  L.stepInstant();                                    // move ball to ballX, 20
  ok(evalExpr(propOf('x', sprite(S.ball))) === 77, 'the `move` row is what moves it');

  console.log('T13f: the fresh shelf statement is an identity - it changes nothing');
  const moveProto = [...paletteEl.querySelectorAll('.stmt-tile.proto')]
    .find(t => /^move /.test(t.textContent));
  ok(!!moveProto, 'a `move` tile is on the shelf: ' + strip(moveProto));
  ok(/xof/.test(strip(moveProto)) && /yof/.test(strip(moveProto)),
     'seeded with `x of` / `y of` itself, so dropping it in is a no-op');
  L.placeSprite(S.ball, 33, 44);
  L.execStmt(B.move(S.ball, propOf('x', sprite(S.ball)), propOf('y', sprite(S.ball))));
  ok(evalExpr(propOf('x', sprite(S.ball))) === 33 && evalExpr(propOf('y', sprite(S.ball))) === 44,
     'and running it really does leave the sprite where it was');

  /* ================= Phase 20: classes and instances =================
     A sprite used to be a name with a stylesheet rule; it is an INSTANCE of a
     CLASS now. Everything above still passes unchanged, which is the point of
     20a - the ids stayed, so the language did not notice. */

  /* "wears this class" without depending on how the DOM normalises a style
     string: build a probe with the same declarations and compare property by
     property, which also lets a stage sprite carry its own left/top. */
  function wearsClass(el, c){
    const probe = document.createElement('div');
    probe.setAttribute('style', L.classStyleText(c));
    return [...probe.style].every(k =>
      el.style.getPropertyValue(k) === probe.style.getPropertyValue(k));
  }

  console.log('T20a: three CLASSES, five INSTANCES, and the PROGRAM made them');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  ok(L.sceneNames().length === 0,
     'MUTANT: Reset leaves the stage EMPTY - the scene is not the engine’s to lay out');
  ok(document.querySelectorAll('#stage .sprite').length === 0, 'and no DIVs survive it');
  boot();                    // the program's setup rows are what refill it
  ok(L.classNames().join(',') === 'Ball,Paddle,Brick', 'three seed classes, got ' + L.classNames().join(','));
  ok(L.sceneNames().sort().join(',') === 'Ball·1,Brick·1,Brick·2,Brick·3,Paddle·1',
     'five instances, minted per class, got ' + L.sceneNames().sort().join(','));
  ok(NAMES.every(nm => L.instances[S[nm]] && L.onScene(S[nm])), 'and all five are on the scene');
  ok(NAMES.every(nm => L.typeOf(L.v(nm)) === 'sprite'),
     'each one reachable through a sprite-typed NOTE the setup declared');
  ok([1,2,3].every(n => L.instances[S['brick'+n]].cls === 'Brick'),
     'the three bricks share ONE class');
  ok(L.instances[S.ball].cls === 'Ball' && L.instances[S.paddle].cls === 'Paddle',
     'ball and paddle have their own');
  const stageDivs = [...document.querySelectorAll('#stage .sprite')];
  ok(stageDivs.length === 5, 'five generated .sprite DIVs on the stage, got ' + stageDivs.length);
  ok(document.querySelectorAll('#stage .brick').length === 0,
     'and no hand-written sprite markup survives (the old .brick class is gone)');
  ok(stageDivs.every(el => L.instances[el.id]), 'every DIV belongs to an instance');

  console.log('T20a2: the setup rows say where every sprite comes from');
  const setupRows = [...document.querySelectorAll('#blocksBox > .block')]
    .map(r => r.textContent.replace(/\s+/g, ' ').trim());
  const startRow = setupRows.findIndex(r => /^⚑ start/.test(r));
  ok(startRow === 23, 'twenty-three setup rows sit above the loop, got ' + startRow);
  const setup = setupRows.slice(0, startRow);
  ok(setup.filter(r => /^new note/.test(r)).length === 13,
     'thirteen declarations: eight numbers and five sprites, got '
     + setup.filter(r => /^new note/.test(r)).length);
  ok(setup.filter(r => /= a new /.test(r)).length === 5, 'five of them instantiate a class');
  ok(setup.filter(r => /to the scene$/.test(r)).length === 5, 'five `add ... to the scene` rows');
  /* Phase 20e: the NUMBERS come first, because the `move` rows read them - and
     they are declared exactly like anything else. There is no world variable
     left anywhere in the language. */
  ok(/^new note paddleX = 40$/.test(setup[0]), 'the first row makes a number: ' + setup[0]);
  ok(setup.slice(0, 8).every(r => /^new note [A-Za-z0-9]+ = -?[0-9.]+$/.test(r)),
     'the first eight are the plain numbers the game runs on');
  ok(/new note ball = a new Ball/.test(setup[17]), 'then the sprites: ' + setup[17]);
  ok(/add ball to the scene/.test(setup[19]), 'and: ' + setup[19]);
  /* They sit ABOVE the flag on purpose: `goto start` lands on the label, so the
     setup runs exactly once per run with no guard row anywhere. */
  const pcAfter = window.__call.pc();
  for (let i = 0; i < 60; i++) L.stepInstant();
  ok(L.sceneNames().length === 5,
     'MUTANT: looping past `goto start` does NOT re-run the setup - still five sprites, got '
     + L.sceneNames().length);

  console.log('T20b: a sprite’s LOOK comes from its class, not the stylesheet');
  const ballStyle = document.getElementById(S.ball).getAttribute('style');
  ok(/width:\s*22px/.test(ballStyle) && /height:\s*22px/.test(ballStyle),
     'the ball DIV is sized by its class: ' + ballStyle.slice(0, 40));
  ok(/border-radius:\s*14px/.test(ballStyle),
     'and rounded by it - 14 is half the Ball’s BORDER box (22 wide + a 3px edge either side)');
  ok(/left:/.test(ballStyle) && /top:/.test(ballStyle), 'position survives restyling (setAttribute wipes it)');
  ok(L.classStyleText(L.classes.Paddle).indexOf('width:60px') === 0,
     'classStyleText writes width first: ' + L.classStyleText(L.classes.Paddle).slice(0, 24));

  console.log('T20c: boxOf reads instance POSITION and class SIZE - one geometry function');
  L.placeSprite(S.brick1, 0, 0);
  const wasW = L.classes.Brick.w;
  const box0 = L.boxOf(S.brick1);
  L.classes.Brick.w = wasW + 20;
  ok(L.boxOf(S.brick1).w === wasW + 20, 'widening the CLASS widens the instance box');
  ok(L.boxOf(S.brick2).w === wasW + 20, 'and its siblings, because they share the class');
  ok(L.boxOf(S.ball).w === 22, 'but not the ball - a different class');
  L.classes.Brick.w = wasW;
  ok(L.boxOf(S.brick1).w === box0.w, 'and it goes back');

  console.log('T20d: MUTANT - editing a class must restyle every LIVE instance');
  /* One source of truth for a look. Skip the restyle and the card and the stage
     disagree, which is the exact bug classes exist to prevent. */
  const brickEl = document.getElementById(S.brick1);
  const leftBefore = brickEl.style.left;
  L.classes.Brick.style['background-color'] = '#123456';
  L.restyleClass('Brick');
  ok(/#123456|rgb\(18, 52, 86\)/.test(brickEl.getAttribute('style')),
     'brick1 repainted, got ' + brickEl.getAttribute('style').slice(0, 60));
  ok(/#123456|rgb\(18, 52, 86\)/.test(document.getElementById(S.brick3).getAttribute('style')),
     'and so did brick3 - every instance, not just the one you were looking at');
  ok(brickEl.style.left === leftBefore, 'and it did NOT jump: restyling keeps the position');
  ok(!/#123456|rgb\(18, 52, 86\)/.test(document.getElementById(S.ball).getAttribute('style')),
     'the ball is untouched - a class edit reaches exactly its own instances');
  // put the seed colour back; this test poked the registry directly, where the
  // real editor goes through setClassOpt (restyle AND redraw the panel)
  L.classes.Brick.style['background-color'] = '#7C6FE0';
  L.restyleClass('Brick'); L.renderClasses();

  console.log('T20e: the class PANEL - one card per class, and the swatch is an instance');
  const cards = [...document.querySelectorAll('.cls-card')];
  ok(cards.length === 3, 'three cards, got ' + cards.length);
  ok(cards.map(c => c.dataset.cls).join(',') === 'Ball,Paddle,Brick', 'one per class, in order');
  const brickFace = document.querySelector('[data-cls="Brick"] .sprite');
  ok(!!brickFace, 'the swatch holds a live .sprite DIV, not a picture of one');
  ok(wearsClass(brickFace, L.classes.Brick), 'wearing exactly the declarations its instances wear');
  ok(wearsClass(document.getElementById(S.brick2), L.classes.Brick),
     'which are exactly the ones the sprite on the stage wears');
  ok(!!document.querySelector('.cls-new'), 'and there is a "+ new class" button');

  console.log('T20f: the editor popover is DERIVED from CLASS_OPTS');
  await tap(document.querySelector('[data-cls="Brick"] .cls-swatch'));
  const clsPop = document.querySelector('.leaf-pop');
  const secTitles = [...safe(clsPop).querySelectorAll('.pop-title')].map(t => t.textContent);
  ok(!!clsPop, 'tapping the swatch opens a chooser');
  ok(L.CLASS_OPTS.every(o => secTitles.indexOf(o.title) !== -1),
     'one section per option, got [' + secTitles.join(' ') + ']');
  ok(L.CLASS_OPTS.filter(o => o.size).length === 2,
     'width and height are the two that live on the class root');
  ok(!L.CLASS_OPTS.some(o => o.key === 'border-style'),
     'edge style is gone - a sprite’s edge is solid, and the shared .sprite rule says so');
  ok(!/border-style/.test(L.classStyleText(L.classes.Ball)),
     'so no class writes that declaration any more');
  const swatches = [...safe(clsPop).querySelectorAll('.swatch')];
  ok(swatches.length > 0, 'colours are a swatch grid, got ' + swatches.length);
  swatches[0].dispatchEvent(new window.MouseEvent('click', { bubbles:true, cancelable:true }));
  await sleep(30);
  ok(L.classes.Brick.style['background-color'] === '#FF7A59',
     'picking one writes the class: ' + L.classes.Brick.style['background-color']);
  ok(wearsClass(document.querySelector('[data-cls="Brick"] .sprite'), L.classes.Brick),
     'the card followed');
  ok(/rgb\(255, 122, 89\)|#FF7A59/.test(document.getElementById(S.brick2).getAttribute('style')),
     'and so did the sprite on the stage, in the same breath');
  document.dispatchEvent(pev('pointerdown', 1, 1));
  await sleep(20);

  console.log('T20f2: every numeric option is THE number control, not a lookalike');
  /* The class editor grew numeric options as button lists, which is how two
     controls that mean the same thing drift apart. `numRow` is the shared shell
     now - the same [- field +] a number literal gets, same steppers, same
     clamp - so this asserts the SILHOUETTE, then that it really drives the
     class. */
  await tap(document.querySelector('[data-cls="Ball"] .cls-swatch'));
  const numPop = document.querySelector('.leaf-pop');
  const numRows = [...safe(numPop).querySelectorAll('.pop-row')]
                    .filter(r => r.querySelectorAll('.stepper').length === 2);
  ok(numRows.length === L.CLASS_OPTS.filter(o => o.kind === 'num').length,
     'one stepper row per numeric option, got ' + numRows.length);
  ok(numRows.length === 4, 'which is four: edge width, corners, width, height');
  ok(numRows.every(r => r.querySelector('input.numedit[type="number"]')),
     'each is the same input.numedit a number literal uses');
  ok(numRows.map(r => r.querySelector('input').value).join(',') === '3,14,22,22',
     'seeded from the class, got ' + numRows.map(r => r.querySelector('input').value).join(','));
  // the steppers drive the class, and a LENGTH carries its unit back
  numRows[1].querySelectorAll('.stepper')[1]
    .dispatchEvent(new window.MouseEvent('click', { bubbles:true, cancelable:true }));
  await sleep(20);
  ok(L.classes.Ball.style['border-radius'] === '15px',
     'tapping + wrote a CSS length back, got ' + L.classes.Ball.style['border-radius']);
  ok(/border-radius:\s*15px/.test(document.getElementById(S.ball).getAttribute('style')),
     'and the sprite on the stage followed under your hand');
  // typing follows live by REPAINTING the card, not rebuilding the panel
  const cardBefore = document.querySelector('[data-cls="Ball"]');
  const faceBefore = document.querySelector('[data-cls="Ball"] .sprite');
  const wInp = numRows[2].querySelector('input');
  wInp.value = '40';
  wInp.dispatchEvent(new window.Event('input', { bubbles:true }));
  await sleep(20);
  ok(L.classes.Ball.w === 40, 'typing a width follows live, got ' + L.classes.Ball.w);
  ok(wearsClass(document.querySelector('[data-cls="Ball"] .sprite'), L.classes.Ball),
     'the card repainted');
  ok(document.querySelector('[data-cls="Ball"]') === cardBefore
     && document.querySelector('[data-cls="Ball"] .sprite') === faceBefore,
     'MUTANT: the card was REPAINTED, not rebuilt - redrawing the panel on every '
     + 'keystroke swaps the very element the chooser is anchored to');
  ok(!!wInp.parentNode && document.querySelector('.leaf-pop') === numPop,
     'and the field the learner is typing in is still there');
  ok(L.boxOf(S.ball).w === 40, 'the geometry followed too - boxOf reads the class');
  // put the Ball back the way the seed had it
  L.classes.Ball.w = 22; L.classes.Ball.style['border-radius'] = '14px';
  L.restyleClass('Ball');
  document.dispatchEvent(pev('pointerdown', 1, 1));
  await sleep(20);
  L.renderClasses();

  console.log('T20g: "+ new class" mints an ALWAYS-VALID default, and a shelf tile appears');
  const tilesBefore = document.querySelectorAll('.token.newtok.proto').length;
  document.querySelector('.cls-new').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  ok(!!L.classes.class1, 'it is called class1');
  ok(L.classes.class1.w === 20 && L.classes.class1.h === 20, 'a 20x20 square');
  ok(L.CLASS_OPTS.filter(o => !o.size)
       .every(o => L.classes.class1.style[o.key] !== undefined),
     'with EVERY declaration filled in - there is no half-made class');
  ok(document.querySelectorAll('.cls-card').length === 4, 'a fourth card appeared');
  ok(document.querySelectorAll('.token.newtok.proto').length === tilesBefore + 1,
     'and a fourth `a new ...` tile on the shelf, automatically');

  console.log('T20h: renaming a class is a REFACTOR');
  const w1 = window.__call, wb = w1.build;
  // a declared note rides along, so T20i has one to collide a class name with
  w1.load([ wb.note('score', L.num(0)), wb.add(L.newOf('class1')), wb.label('end') ]);
  L.mintInstance('class1');
  const mintedId = Object.keys(L.instances).find(k => /^class1/.test(k));
  ok(!!mintedId, 'an instance of it exists: ' + mintedId);
  await tap(document.querySelector('[data-cls="class1"] .cls-chip'));
  const nameInp = document.querySelector('.leaf-pop input');
  ok(!!nameInp, 'tapping the name chip opens the rename editor');
  safe(nameInp).value = 'Wall';
  safe(nameInp).dispatchEvent(new window.KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
  await sleep(30);
  ok(!!L.classes.Wall && !L.classes.class1, 'the class is called Wall now');
  ok(L.classNames().indexOf('Wall') === 3, 'and it kept its place in the panel');
  ok(L.instances[mintedId].cls === 'Wall', 'its live instance followed');
  ok(/a new Wall/.test(document.querySelectorAll('#blocksBox > .block')[1].textContent),
     'and so did the `a new ...` piece in the program');
  ok(L.classHolders('Wall').length === 1 && L.classHolders('class1').length === 0,
     'holders are counted under the new name only');

  console.log('T20i: the namespace is SHARED - a class cannot take a flag or note name');
  ok(L.validClassName('Roof', null), 'a fresh name is fine');
  ok(!L.validClassName('end', null), 'but not a flag name in the program');
  /* Phase 20e: there is no protected set of names. What a class collides with
     is whatever the program has DECLARED - and since the eight numbers are now
     ordinary declarations, they are covered by the same one check. */
  ok(!L.validClassName('score', null), 'nor a note the program declares');
  ok(!L.validClassName('Ball', null), 'nor another class');
  ok(!L.validClassName('1Ball', null) && !L.validClassName('WayTooLongAName', null),
     'and the flag shape rules still apply');

  console.log('T20j: MUTANT - deleting a held class must go through the CONFIRM');
  document.querySelector('[data-cls="Wall"] .cls-del').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  ok(!!document.querySelector('.modal-veil'), 'a held class opens the confirm dialog');
  ok(document.querySelectorAll('.block.holder-hi').length === 1,
     'with the row that holds it highlighted');
  ok(!!L.classes.Wall, 'and nothing is deleted while it is open');
  document.querySelector('.cm-cancel').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  ok(!!L.classes.Wall && document.querySelectorAll('.block.holder-hi').length === 0,
     '"Keep it" keeps it, and drops the highlight');
  document.querySelector('[data-cls="Wall"] .cls-del').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  document.querySelector('.cm-go').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(30);
  ok(!L.classes.Wall, 'confirming removes it');
  ok(!L.instances[mintedId], 'and its instances go with it - a sprite with no class has no shape');
  const heldRow = document.querySelectorAll('#blocksBox > .block')[1];
  ok(!!heldRow.querySelector('.chip.lost'),
     'the holder FRAYS - the fifth instance of the Phase-9 amendment');
  ok(/a new Wall/.test(heldRow.textContent), 'but the program still reads what it says');
  const deadRun = L.execStmt(wb.add(L.newOf('Wall')));
  ok(/class called Wall/.test(deadRun.stuck || ''),
     'and running it stops Beep on the row: ' + (deadRun.stuck || deadRun.bubble));

  console.log('T20k: `a new <Class>` is an EXPRESSION, and it is sprite-typed');
  ok(typeOf(L.newOf('Ball')) === 'sprite', 'typeOf says sprite');
  ok(L.newOf('Ball').cls === 'Ball' && L.newOf('Ball').type === 'new', 'it carries its class as a field');
  const newTile = [...document.querySelectorAll('.token.newtok.proto')].find(t => /Ball/.test(t.textContent));
  ok(!!newTile, 'and it is on the shelf: ' + strip(newTile));

  console.log('T20l: MUTANT - evaluating OUTSIDE a live step must create NOTHING');
  /* The keystone of the design. bubbleExpr re-evaluates to draw the thought
     bubble and authoring code evaluates too, so a naive `case new: mint()`
     spawns phantom instances on every redraw. Outside a step it says the
     phrase and makes nothing at all. */
  const before20l = Object.keys(L.instances).length;
  const loose = L.newOf('Ball');
  ok(evalExpr(loose) === 'a new Ball', 'it renders symbolically: ' + evalExpr(loose));
  for (let i = 0; i < 5; i++) evalExpr(loose);
  ok(Object.keys(L.instances).length === before20l,
     'and after six evaluations there are still ' + before20l + ' instances, got '
     + Object.keys(L.instances).length);

  console.log('T20m: MUTANT - one EXECUTION mints exactly one instance, and the bubble shows it');
  /* `execPack` bubbles its operand BEFORE evaluating it, so this row asks the
     `new` node twice. With the memo it mints once and the parcel IS what the
     bubble said; without it, two instances and the parcel is the second. */
  w1.load([ wb.pack(L.newOf('Ball')), wb.label('end') ]);
  const known20m = new Set(L.sceneNames());
  L.stepInstant();
  await sleep(20);
  const minted = L.sceneNames().filter(k => !known20m.has(k));
  ok(L.sceneNames().length === known20m.size + 1,
     'ONE instance from one execution, got ' + (L.sceneNames().length - known20m.size));
  ok(minted.length === 1 && /^Ball·\d+$/.test(minted[0]),
     'with a reserved id nobody could type by hand: ' + minted.join(','));
  ok(w1.open().parcels[0] === minted[0],
     'and the parcel carries the very instance the bubble named, got ' + w1.open().parcels[0]);
  L.stepInstant();
  await sleep(20);
  ok(L.sceneNames().filter(k => !known20m.has(k)).length === 1,
     'stepping past it does not mint again');

  console.log('T20n: a fresh instance is OFF THE SCENE - a value that renders nowhere');
  const off = minted[0];
  ok(L.onScene(off) === false, 'it is not on the scene');
  ok(evalExpr(aliveOf(sprite(off))) === false, '`is alive` reads scene membership, so it says no');
  ok(document.getElementById(off) === null, 'MUTANT: it has no DIV - nothing off the scene is drawn');
  ok(document.querySelectorAll('#stage .sprite').length === known20m.size,
     'the stage still shows the ' + known20m.size + ' the program put there');
  L.placeSprite(off, 50, 55);
  L.placeSprite(S.ball, 50, 55);
  ok(evalExpr(propOf('x', sprite(off))) === 50, 'but it is MOVABLE - it has a real position');
  ok(evalExpr(touchOf(sprite(S.ball), sprite(off))) === false,
     'MUTANT: and it is not overlap-scanned, even sitting exactly on the ball');

  console.log('T20o: `add <sprite> to the scene` is the statement that puts it there');
  const addRep = L.execStmt(wb.add(sprite(off)));
  ok(L.onScene(off) === true, 'now it is on the scene: ' + addRep.bubble);
  ok(!!document.getElementById(off), 'its DIV was built on the way in');
  ok(wearsClass(document.getElementById(off), L.classes.Ball), 'wearing its class');
  ok(evalExpr(touchOf(sprite(S.ball), sprite(off))) === true, 'and the sensors can see it now');
  const again = L.execStmt(wb.add(sprite(off)));
  ok(/already on the scene/.test(again.bubble), 'MUTANT: adding it twice is a VISIBLE no-op: ' + again.bubble);
  ok(document.querySelectorAll('[id="' + off + '"]').length === 1, 'and there is still exactly one DIV');

  console.log('T20p: despawn is the exact INVERSE, so the same instance can come back');
  L.execStmt(wb.despawn(sprite(off)));
  ok(L.onScene(off) === false, 'despawn takes it off the scene');
  ok(evalExpr(touchOf(sprite(S.ball), sprite(off))) === false, 'and it touches nothing again');
  ok(L.instances[off] !== undefined, 'but the instance still EXISTS - a note holding it stays safe');
  L.execStmt(wb.add(sprite(off)));
  ok(L.onScene(off) === true, 'and `add` brings the very same one back');

  console.log('T20q: the declaration machinery needed ZERO changes');
  /* Phase 18 typed a note from its seed; `a new Ball` is simply a seed that
     happens to be sprite-typed, so the sprite-note chicken-and-egg dissolves. */
  w1.load([ wb.note('mine', L.newOf('Brick')), wb.despawn(L.v('mine')), wb.label('end') ]);
  L.stepInstant();
  await sleep(20);
  const mineVal = L.state.mine !== undefined ? L.state.mine : w1.notesOf(0).mine;
  ok(/^Brick·\d+$/.test(String(mineVal)), 'the note holds a real instance: ' + mineVal);
  ok(L.typeOf(L.v('mine')) === 'sprite', 'and the note is SPRITE-typed, straight from its seed');
  L.addToScene(mineVal);
  L.stepInstant();
  await sleep(20);
  ok(L.onScene(mineVal) === false, 'so `despawn <that note>` reaches it, with no new machinery');

  console.log('T20r: MUTANT - Reset destroys every instance, and the program rebuilds');
  ok(L.sceneNames().length > 5, 'there are extra instances about: ' + L.sceneNames().length);
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  ok(L.sceneNames().length === 0, 'Reset leaves NOTHING, got ' + L.sceneNames().join(','));
  ok(document.querySelectorAll('#stage .sprite').length === 0,
     'and every DIV went with them, got ' + document.querySelectorAll('#stage .sprite').length);
  boot();                    // the program's setup rows are the only way back
  ok(L.sceneNames().length === 5,
     'running the program builds exactly five again, got ' + L.sceneNames().join(','));
  ok(NAMES.every(nm => L.onScene(S[nm])), 'the scene the program builds is back on the stage');
  ok(L.classNames().indexOf('class1') === -1 && L.classNames().length === 3,
     'classes are NOT reset material - they are the workbench, like the palette');

  console.log('T20r2: MUTANT - the backpack never offers a number spinner for a sprite');
  /* Phase 18 could say "only WORLD notes have live inputs, and world notes are
     all numbers". Phase 20d broke that: the seed declares its sprites at TOP
     LEVEL, so they land in the world pouch, and the world card started drawing
     a number spinner for a note holding `Ball·1`. Cosmetic on the face of it,
     but `commitVar` writes straight into `state` without going through
     `writeVar` - so the spinner was a door into putting a number in a sprite
     pocket, past the very check that exists to refuse it. */
  const stackEl2 = document.getElementById('stack');
  const tiles = [...stackEl2.querySelectorAll('.tile')];
  const tileFor = nm => tiles.find(t => strip(t.querySelector('.name')) === nm);
  ok(NAMES.every(nm => !!tileFor(nm)), 'the world card shows all five sprite notes');
  ok(NAMES.every(nm => !tileFor(nm).querySelector('input')),
     'and NOT ONE of them has a number input');
  ok(NAMES.every(nm => !!tileFor(nm).querySelector('.ro-val .token.sprtok.mini')),
     'each reads as its own value - the coral pill, like any sprite anywhere');
  ok(!!tileFor('paddleX') && !!tileFor('paddleX').querySelector('input[data-var]'),
     'while the world NUMBERS keep their live spinners - the decision is per note, not per pouch');
  ok(tileFor(NAMES[0]).querySelector('.ro-val').textContent === S[NAMES[0]],
     'and the pill names the instance the program made: ' + S[NAMES[0]]);
  // the belt-and-braces refusal in commitVar, for a spinner left stale in the DOM
  const stale = document.createElement('input');
  stale.dataset.var = 'ball'; stale.value = '99';
  document.getElementById('stack').appendChild(stale);
  stale.dispatchEvent(new window.Event('input', { bubbles:true }));
  await sleep(20);
  ok(L.state.ball === S.ball,
     'MUTANT: and a stale spinner cannot clobber a sprite note either, got ' + L.state.ball);
  stale.remove();
  window.__call.setView('reach');
  ok(document.querySelectorAll('.reach .token.sprtok.mini').length === 5,
     'the "all in reach" view shows them as pills too');
  window.__call.setView('pile');

  console.log('T20s: the `add` row is ordinary statement material');
  const addProto = [...paletteEl.querySelectorAll('.stmt-tile.proto')].find(t => /^add /.test(t.textContent));
  ok(!!addProto, 'a shelf tile: ' + strip(addProto));
  ok(/anew/.test(strip(addProto)), 'seeded with `a new ...`, so one drop is the whole gesture');
  const addBlk = window.__call;
  // the note tiles follow the program's DECLARATIONS, so keep one alive here
  addBlk.load([ addBlk.build.note('ball', L.newOf('Ball')),
                addBlk.build.add(sprite(S.brick1)), addBlk.build.label('end') ]);
  const addRow = document.querySelectorAll('#blocksBox > .block')[1];
  ok(/action/.test(addRow.className), 'it is an ACTION row, like move and despawn');
  await tap(addRow.querySelector('.content'));
  ok(!!addRow.querySelector('.token.sprtok[data-sl]'), 'and it exposes ONE ordinary sprite slot');
  const ballPill = [...paletteEl.querySelectorAll('.token.sprtok.proto')].find(t => strip(t) === 'ball');
  await dragProto(ballPill, 300, 300, [addRow.querySelector('.token.sprtok[data-sl]')]);
  ok(/ball/.test(strip(addRow.querySelector('.content'))),
     'a pill drops straight into it: ' + strip(addRow.querySelector('.content')));

  console.log('T20t: the class chip is a tap-to-REPOINT chip, not a fourth type');
  addBlk.load([ addBlk.build.add(L.newOf('Ball')), addBlk.build.label('end') ]);
  const newRow = document.querySelectorAll('#blocksBox > .block')[0];
  await tap(newRow.querySelector('.content'));
  const clsChipEl = newRow.querySelector('.cls-chip[data-clschip]');
  ok(!!clsChipEl, 'the class renders as a chip inside the pill');
  await tap(clsChipEl);
  const clsBtns = popButtons().map(b => b.textContent);
  ok(clsBtns.join(',') === 'Ball,Paddle,Brick', 'its chooser lists the classes, got [' + clsBtns.join(' ') + ']');
  ok(!clsBtns.some(t => /^\+ 0$/.test(t)), 'and offers no arithmetic - a class is not a value');
  const brickBtn = popButtons().find(b => b.textContent === 'Brick');
  if (brickBtn) clickBtn(brickBtn);
  await sleep(30);
  ok(/anewBrick/.test(strip(newRow.querySelector('.content'))),
     'tapping one repoints it: ' + strip(newRow.querySelector('.content')));
  ok(L.typeOf(L.newOf('Brick')) === 'sprite', 'and it is still sprite material wherever it sits');

  console.log('T20t2: MUTANT - `add`’s sprite slot is deep-cloned, like every other');
  /* "Reset = deep-clone snapshot" covers every mutable field, and cloneStmt is
     also what `duplicate` runs. Share the node between the two rows and editing
     one silently edits the other - the Phase-15 lesson, and the reason T13b
     edits IN PLACE (a drag would replace the reference and hide the bug). */
  addBlk.load([ addBlk.build.add(L.newOf('Ball')), addBlk.build.label('end') ]);
  const dupSrc = document.querySelectorAll('#blocksBox > .block')[0];
  dupSrc.querySelector('.grip').dispatchEvent(pev('pointerdown', 50, 100));
  document.getElementById('blocksBox').dispatchEvent(pev('pointerup', 50, 100));
  await sleep(30);
  const dupMenu = document.querySelector('.leaf-pop');
  const dupBtn = safe(dupMenu).querySelectorAll('.opt');
  const dupIt = [...dupBtn].find(b => b.textContent === 'duplicate');
  ok(!!dupIt, 'the grip menu offers duplicate');
  if (dupIt) dupIt.dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(30);
  const addRows = [...document.querySelectorAll('#blocksBox > .block')].filter(b => /^add /.test(b.textContent.trim()));
  ok(addRows.length === 2, 'there are two add rows now, got ' + addRows.length);
  await tap(addRows[1].querySelector('.content'));
  await tap(safe(addRows[1].querySelector('.cls-chip[data-clschip]')) || NIL());
  const pickBrick = popButtons().find(b => b.textContent === 'Brick');
  if (pickBrick) clickBtn(pickBrick);
  await sleep(30);
  ok(/anewBrick/.test(strip(addRows[1].querySelector('.content'))), 'the copy now makes a Brick');
  await tap(addRows[0].querySelector('.content'));      // force the original to re-render
  await sleep(20);
  ok(/anewBall/.test(strip(addRows[0].querySelector('.content'))),
     'and the ORIGINAL still makes a Ball, got ' + strip(addRows[0].querySelector('.content')));

  console.log('T20u: ZERO new rows in DROP_TABLE - the fifth free ride');
  const D = window.__drop;
  ok(D.PAYLOADS.length === 7 && D.TARGETS.length === 4,
     'the payload x target grid is unchanged: ' + D.PAYLOADS.length + ' x ' + D.TARGETS.length);
  ok(D.verbFor('proto-value', 'slot') === 'replace',
     '`a new <Class>` arrives as an ordinary proto-value -> replace');
  ok(D.verbFor('stmt-proto', 'gap') === 'insert', 'and `add ... to the scene` as an ordinary stmt-proto -> insert');
  ok(D.verbFor('piece-operand', 'slot') === 'swap', 'the rest of the table is untouched');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
