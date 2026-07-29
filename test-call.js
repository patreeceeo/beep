/* Phase 13 — visits (calls), the bookmark stack, and the parcel belt.

   Three things are on trial here:
   (1) SEMANTICS: a visit remembers where it came from, a return goes back to
       the row AFTER the call, nesting is LIFO, and the belt is FIFO in both
       directions (arguments in, results out).
   (2) THE FAILURE SURFACES: every broken case is the same confused halt with
       pc PARKED on the offending row - empty stack, empty belt, a bookmark
       whose row was deleted, a lost flag, and the recursion cap.
   (3) THE GESTURES + SURFACES: the four prototypes drop in as real blocks, a
       fresh visit binds to the nearest flag, its rope is dashed, the LHS
       chooser retargets an unpack, and the belt / bookmark tokens draw what
       the interpreter is actually holding.

   T19+ cover `ifvisit` (Phase 13b): the conditional call that closes the
   (one-way | comes-back) x (always | if) grid.

   Semantics go through stepInstant (synchronous - no animation to flush) over
   little programs installed via the window.__call seam. */
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
// a MATERIALIZED drag (statement prototype -> real block): the events ride
// blocksBox, not document - same idiom test-phase9 uses. The block lands at the
// end of the program, which is where the reorder gap leaves it.
async function dragStmt(srcEl, x, y) {
  srcEl.dispatchEvent(pev('pointerdown', 15, 515));
  document.getElementById('blocksBox').dispatchEvent(pev('pointermove', x, y));
  document.getElementById('blocksBox').dispatchEvent(pev('pointerup', x, y));
  await sleep(30);
}

(async () => {
  await sleep(50);
  const C = window.__call;
  const L = window.__lang;
  const B = C.build;
  const step = () => L.stepInstant();
  const bubble = document.getElementById('bubble');
  const blocksBox = document.getElementById('blocksBox');
  const beltEl = document.getElementById('belt');
  const paletteEl = document.getElementById('palette');
  const trayEl = document.getElementById('tray');

  /* A subroutine that doubles whatever it is handed:
       0 label start
       1 pack <arg>
       2 visit double
       3 unpack into ballX      <- the visit comes back HERE
       4 goto done
       5 label double
       6 unpack into paddleX
       7 pack paddleX + paddleX
       8 return
       9 label done                                                        */
  function doublerProgram(arg) {
    return [
      B.label('start'),
      B.pack(B.num(arg)),
      B.visit('double'),
      B.unpack('ballX'),
      B.goto_('done'),
      B.label('double'),
      B.unpack('paddleX'),
      B.pack(B.bin('+', B.v('paddleX'), B.v('paddleX'))),
      B.ret(),
      B.label('done')
    ];
  }

  console.log('T1: the new statements reached the shelf and render their faces');
  const stmtProtos = [...paletteEl.querySelectorAll('.stmt-tile.proto')];
  ok(stmtProtos.length === 12, '12 statement prototypes, got ' + stmtProtos.length);
  const faces = stmtProtos.map(el => el.textContent);
  ok(faces.some(t => /^visit/.test(t)), 'a visit tile');
  ok(faces.some(t => /return/.test(t)), 'a return tile');
  ok(faces.some(t => /^pack .* onto the belt$/.test(t)), 'a pack tile with an expression');
  ok(faces.some(t => /^unpack into/.test(t)), 'an unpack tile with a target chip');
  const visitProto = stmtProtos.find(el => /^visit/.test(el.textContent));
  ok(visitProto.querySelector('.flagref') !== null, 'a visit carries a flagref chip, like a jump');
  ok(stmtProtos.find(el => /return/.test(el.textContent)).querySelector('.flagref') === null,
     'return carries NO chip - its destination is data, not syntax');

  console.log('T2: a visit remembers; a return comes back to the row AFTER the call');
  C.load(doublerProgram(5));
  step();                                     // label start
  step();                                     // pack 5
  ok(C.belt().length === 1 && C.belt()[0] === 5, 'the parcel is on the belt');
  ok(C.stack().length === 0, 'no bookmark yet');
  step();                                     // visit double
  ok(C.stack().length === 1, 'the visit dropped a bookmark');
  ok(C.pc() === 5, 'Beep is at the flag (row 5), got ' + C.pc());
  step();                                     // label double
  step();                                     // unpack into paddleX
  ok(L.state.paddleX === 5, 'the routine unpacked its argument (paddleX=' + L.state.paddleX + ')');
  ok(C.belt().length === 0, 'the belt is empty again');
  step();                                     // pack paddleX + paddleX
  ok(C.belt()[0] === 10, 'the routine packed its answer, got ' + C.belt()[0]);
  step();                                     // return
  ok(C.stack().length === 0, 'the bookmark was spent');
  ok(C.pc() === 3, 'came back to the row AFTER the call (3), got ' + C.pc());
  step();                                     // unpack into ballX
  ok(L.state.ballX === 10, 'the caller got the answer back (ballX=' + L.state.ballX + ')');
  ok(C.belt().length === 0, 'nothing left over - both sides agreed');

  console.log('T3: the belt is FIFO - first parcel on is the first one off');
  C.load([
    B.pack(B.num(1)),
    B.pack(B.num(2)),
    B.unpack('paddleX'),
    B.unpack('ballX'),
    B.label('end')
  ]);
  step(); step();
  ok(C.belt().join(',') === '1,2', 'belt order is packing order');
  step();
  ok(L.state.paddleX === 1, 'the FRONT parcel came off first (got ' + L.state.paddleX + ')');
  step();
  ok(L.state.ballX === 2, 'then the next one (got ' + L.state.ballX + ')');

  console.log('T4: nesting is LIFO - the newest bookmark is the one that is spent');
  C.load([
    B.visit('outer'),        // 0
    B.assign('paddleX', B.num(99)),  // 1  <- outer comes back here
    B.goto_('end'),          // 2
    B.label('outer'),        // 3
    B.visit('inner'),        // 4
    B.ret(),                 // 5  <- inner comes back here
    B.label('inner'),        // 6
    B.ret(),                 // 7
    B.label('end')           // 8
  ]);
  step();                                     // visit outer
  step();                                     // label outer
  step();                                     // visit inner
  ok(C.stack().length === 2, 'two bookmarks are open');
  step();                                     // label inner
  step();                                     // return (inner)
  ok(C.pc() === 5, 'the INNER return came back to row 5, got ' + C.pc());
  ok(C.stack().length === 1, 'one bookmark left');
  step();                                     // return (outer)
  ok(C.pc() === 1, 'the OUTER return came back to row 1, got ' + C.pc());
  ok(C.stack().length === 0, 'the pile is empty');

  console.log('T5: recursion runs, and overflowing the pile is a WATCHABLE halt');
  C.load([ B.label('again'), B.visit('again'), B.label('end') ]);
  for (let k = 0; k < 60; k++) step();         // spin well past the cap
  ok(C.stack().length === C.CALL_MAX, 'the pile stopped at the cap (' + C.CALL_MAX + '), got ' + C.stack().length);
  ok(/too many visits/.test(bubble.textContent), 'Beep says he lost track: ' + bubble.textContent);
  ok(C.pc() === 1, 'pc parked ON the visit row, got ' + C.pc());
  ok(document.getElementById('robot').classList.contains('confused'), 'and he wears his confusion');

  console.log('T6: unpacking an empty belt stops him (and does not write)');
  C.load([ B.unpack('paddleX'), B.label('end') ]);
  L.state.paddleX = 42;
  step();
  ok(/belt is empty/.test(bubble.textContent), 'the bubble names the problem: ' + bubble.textContent);
  ok(L.state.paddleX === 42, 'the variable was NOT written');
  ok(C.pc() === 0, 'pc parked on the unpack row, got ' + C.pc());
  step();
  ok(C.pc() === 0, 'stepping again hits the same wall - the bug is still there');

  console.log('T7: returning with no bookmark stops him too');
  C.load([ B.ret(), B.label('end') ]);
  step();
  ok(/no bookmark/.test(bubble.textContent), 'the bubble names it: ' + bubble.textContent);
  ok(C.pc() === 0, 'pc parked on the return row, got ' + C.pc());

  console.log('T8: a bookmark whose row was DELETED dangles - it does not rot silently');
  C.load([
    B.visit('sub'),      // 0
    B.assign('ballX', B.num(1)),  // 1
    B.goto_('end'),      // 2
    B.label('sub'),      // 3
    B.ret(),             // 4
    B.label('end')       // 5
  ]);
  step();                                     // visit sub -> bookmark on row 0
  ok(C.stack().length === 1, 'bookmark placed');
  C.dropRow(0);                               // the learner deletes the call row mid-visit
  step();                                     // label sub
  step();                                     // return
  ok(/bookmark/.test(bubble.textContent) && /gone/.test(bubble.textContent),
     'Beep says his bookmark is gone: ' + bubble.textContent);
  ok(C.stack().length === 1, 'the dead bookmark is KEPT, so the bug stays steppable');

  console.log('T9: a visit to a lost flag halts exactly like a lost jump');
  C.load([ B.visit('nowhere'), B.label('end') ]);
  step();
  ok(/where did it go/.test(bubble.textContent), 'the familiar lost-flag bubble: ' + bubble.textContent);
  ok(C.pc() === 0, 'pc parked on the visit row');

  console.log('T10: a /0 inside a pack refuses the pack (nothing reaches the belt)');
  C.load([ B.pack(B.bin('/', B.num(5), B.num(0))), B.label('end') ]);
  step();
  ok(C.belt().length === 0, 'no parcel was made');
  ok(/does not compute/.test(bubble.textContent), 'the divide-by-zero bubble: ' + bubble.textContent);
  ok(C.pc() === 0, 'pc parked on the pack row');

  console.log('T11: leftover parcels stay VISIBLE (the bug you can see)');
  C.load([ B.pack(B.num(7)), B.pack(B.num(8)), B.unpack('paddleX'), B.label('end') ]);
  step(); step(); step();
  ok(C.belt().length === 1 && C.belt()[0] === 8, 'one parcel left behind');
  ok(beltEl.querySelectorAll('.parcel').length === 1, 'and the belt panel shows exactly one');
  ok(beltEl.querySelector('.parcel').classList.contains('front'), 'it is marked as the front of the queue');

  console.log('T12: the bookmark pile is drawn, counted, and pinned to the return row');
  C.load([
    B.label('again'),                  // 0
    B.visit('again'),                  // 1
    B.assign('ballX', B.num(1)),       // 2  <- every bookmark returns here
    B.label('end')                     // 3
  ]);
  ok(blocksBox.querySelectorAll('.bookmark').length === 0, 'no tokens before the run');
  step(); step();                              // label, visit
  ok(blocksBox.querySelectorAll('.bookmark').length === 1, 'one token after one visit');
  step(); step();                              // label, visit again
  const marks = blocksBox.querySelectorAll('.bookmark');
  ok(marks.length === 1, 'two bookmarks on the SAME return row share one token');
  ok(marks[0].textContent === '2', 'and it counts them (' + marks[0].textContent + ')');

  console.log('T13: Reset clears the pile and the belt with the run');
  C.load([ B.label('a'), B.visit('a'), B.label('end') ]);
  step(); step();
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(30);
  ok(C.stack().length === 0, 'the bookmark pile is empty');
  ok(C.belt().length === 0, 'the belt is empty');
  ok(blocksBox.querySelectorAll('.bookmark').length === 0, 'no tokens left on screen');
  ok(beltEl.querySelector('.belt-empty') !== null, 'the belt panel says so');

  console.log('T14: dropping a visit prototype binds it to a real flag');
  setRect(trayEl, 600, 0, 200, 60);
  setRect(document.getElementById('trash'), 900, 0, 74, 60);
  const rows = () => [...blocksBox.querySelectorAll(':scope > .block')];
  const before = rows().length;
  await dragStmt(visitProto, 100, 300);
  ok(rows().length === before + 1, 'the visit landed as a real block');
  const visitRow = [...blocksBox.querySelectorAll(':scope > .block.visit')].pop();
  ok(visitRow !== undefined, 'and it renders as a visit row');
  ok(visitRow.querySelector('.flagref') && !visitRow.querySelector('.flagref.lost'),
     'it bound to a real flag: ' + visitRow.textContent.trim());

  console.log('T15: a visit gets a rope, and it is DASHED; return gets none');
  // the seed program's arrow handlers are ifvisits, whose ropes are `cond call`;
  // a PLAIN visit's rope is `call` and not `cond`, so scope to that
  const plainCalls = () => [...document.getElementById('wires').querySelectorAll('path.call:not(.cond)')];
  ok(plainCalls().length === 1, 'exactly one plain call rope, got ' + plainCalls().length);
  ok(plainCalls()[0].getAttribute('d'), 'and it is actually drawn');
  const ropesBefore = document.getElementById('wires').querySelectorAll('path').length;
  const retProto = stmtProtos.find(el => /return/.test(el.textContent));
  await dragStmt(retProto, 100, 300);
  const retRow = [...blocksBox.querySelectorAll(':scope > .block.return')].pop();
  ok(retRow !== undefined, 'the return landed too');
  ok(document.getElementById('wires').querySelectorAll('path').length === ropesBefore,
     'return added NO rope - there is nothing static to draw');

  console.log('T16: tapping an unpack target opens the variable chooser');
  const unpackProto = stmtProtos.find(el => /^unpack into/.test(el.textContent));
  await dragStmt(unpackProto, 100, 300);
  const unpackRow = [...blocksBox.querySelectorAll(':scope > .block.unpack')].pop();
  ok(unpackRow !== undefined, 'the unpack landed');
  const chip = unpackRow.querySelector('.tgt-chip');
  chip.dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  const pop = document.querySelector('.leaf-pop');
  ok(pop !== null, 'the chooser opened');
  ok(/unpack the parcel into/.test(pop.textContent), 'and it asks the unpack question');
  const opt = [...pop.querySelectorAll('.opt')].find(b => b.textContent === 'brick1X');
  opt.dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  ok(/brick1X/.test(unpackRow.textContent), 'the unpack now writes into brick1X');

  console.log('T17: pack is focusable - its expression is ordinary material');
  const packProto = stmtProtos.find(el => /^pack .* onto the belt$/.test(el.textContent));
  await dragStmt(packProto, 100, 300);
  const packRow = [...blocksBox.querySelectorAll(':scope > .block.pack')].pop();
  ok(packRow !== undefined, 'the pack landed');
  packRow.querySelector('.content').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  ok(packRow.classList.contains('focused'), 'tapping it focuses the row');
  ok(packRow.querySelector('[data-sl]') !== null, 'its operand is a real, draggable slot');

  console.log('T18: Reset restores the seed - which USES visits (Phase 13b)');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(30);
  ok(blocksBox.querySelector('.block.visit') === null, 'the dropped plain visit is gone');
  ok(blocksBox.querySelector('.block.pack') === null, 'the dropped pack is gone');
  ok(blocksBox.querySelector('.block.unpack') === null, 'the dropped unpack is gone');
  // the seed's own arrow handlers are subroutines, so returns SHOULD survive Reset
  ok(blocksBox.querySelectorAll(':scope > .block.return').length === 2,
     'the seed keeps its 2 arrow-handler returns');
  ok(blocksBox.querySelectorAll(':scope > .block.check.callrow').length === 2,
     'and its 2 ifvisit callers');

  /* ---------------- Phase 13b: the conditional call ---------------- */

  console.log('T19: ifvisit takes the call only when the answer is yes');
  // `visit bump` is guarded by a comparison the test drives via ballX
  const guarded = () => [
    B.label('top'),                                          // 0
    B.ifvisit(L.cmp('<', B.v('ballX'), B.num(50)), 'bump'),  // 1
    B.assign('paddleX', B.num(7)),                           // 2 <- the call comes back HERE
    B.goto_('done'),                                         // 3
    B.label('bump'),                                         // 4
    B.assign('ballY', B.num(3)),                             // 5
    B.ret(),                                                 // 6
    B.label('done')                                          // 7
  ];
  C.load(guarded());
  L.state.ballX = 10;                        // 10 < 50 -> yes
  step();                                    // label top
  step();                                    // ifvisit -> taken
  ok(C.stack().length === 1, 'a yes dropped a bookmark');
  ok(C.pc() === 4, 'and jumped to the flag (4), got ' + C.pc());
  step();                                    // label bump
  step();                                    // ballY = 3
  step();                                    // return
  ok(C.pc() === 2, 'the return came back to the row after the ifvisit, got ' + C.pc());
  ok(C.stack().length === 0, 'bookmark spent');

  console.log('T20: a NO falls through and leaves the pile alone');
  C.load(guarded());
  L.state.ballX = 90;                        // 90 < 50 -> no
  step();                                    // label top
  step();                                    // ifvisit -> not taken
  ok(C.stack().length === 0, 'no bookmark was dropped');
  ok(C.pc() === 2, 'it fell through to the next row, got ' + C.pc());
  // stepInstant does not paint bubbles (only the animated path and halts do),
  // so ask the statement what it REPORTED rather than reading stale DOM
  const noResult = L.execStmt(B.ifvisit(L.cmp('<', B.v('ballX'), B.num(50)), 'bump'));
  ok(noResult.visit === undefined, 'a no reports no visit at all');
  ok(/50\? no/.test(noResult.bubble), 'and it reports the failed test: ' + noResult.bubble);

  console.log('T21: an ifvisit to a lost flag halts like every other lost reference');
  C.load([ B.ifvisit(L.bool(true), 'nowhere'), B.label('end') ]);
  step();
  ok(/where did it go/.test(bubble.textContent), 'the lost-flag bubble: ' + bubble.textContent);
  ok(C.pc() === 0, 'pc parked on the ifvisit row');
  ok(C.stack().length === 0, 'and no bookmark was left behind');

  console.log('T22: it respects the recursion cap too (it is the same visit door)');
  C.load([ B.label('again'), B.ifvisit(L.bool(true), 'again'), B.label('end') ]);
  for (let k = 0; k < 60; k++) step();
  ok(C.stack().length === C.CALL_MAX, 'capped at ' + C.CALL_MAX + ', got ' + C.stack().length);
  ok(/too many visits/.test(bubble.textContent), 'same overflow bubble: ' + bubble.textContent);

  console.log('T23: a /0 in its condition refuses to decide (as ifjump does)');
  C.load([ B.ifvisit(L.cmp('<', B.bin('/', B.num(1), B.num(0)), B.num(9)), 'end'), B.label('end') ]);
  step();
  ok(/does not compute/.test(bubble.textContent), 'the /0 bubble: ' + bubble.textContent);
  ok(C.stack().length === 0, 'no bookmark on a poisoned condition');
  ok(C.pc() === 0, 'pc parked on the row');

  console.log('T24: the shelf tile drops in, binds a flag, and is editable material');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(30);
  const ifVisitProto = stmtProtos.find(el => /^if .* visit/.test(el.textContent));
  ok(ifVisitProto !== undefined, 'an ifvisit tile is on the shelf');
  ok(ifVisitProto.querySelector('.chip') !== null, 'it carries a real condition (compact view)');
  await dragStmt(ifVisitProto, 100, 300);
  const ifVisitRow = [...blocksBox.querySelectorAll(':scope > .block.check.callrow')].pop();
  ok(ifVisitRow !== undefined, 'it landed as an ifvisit block');
  ok(ifVisitRow.querySelector('.flagref') && !ifVisitRow.querySelector('.flagref.lost'),
     'it bound to a real flag: ' + ifVisitRow.textContent.trim());
  ifVisitRow.querySelector('.content').dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
  await sleep(20);
  ok(ifVisitRow.classList.contains('focused'), 'tapping it focuses the row');
  ok(ifVisitRow.querySelector('[data-sl]') !== null, 'its condition is a real, draggable slot');

  console.log('T25: its rope is BOTH conditional and a call');
  // 2 come from the seed's arrow handlers + the one just dropped
  const ivWire = [...document.getElementById('wires').querySelectorAll('path.cond.call')];
  ok(ivWire.length === 3, 'three cond+call ropes (2 seed + 1 dropped), got ' + ivWire.length);
  ok(ivWire.every(w => w.getAttribute('d')), 'and they are all drawn');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
