/* Visits, pouches, notes — Phases 13, 13b and 14.

   Phase 14 replaced the single global belt with a STACK OF POUCHES, so the
   pack/unpack tests here are REWRITTEN rather than preserved. The observable
   differences, all asserted below:
     - pack fills the OPEN pouch (staged for the next visit), not a global belt,
       so pack-then-unpack in one pouch no longer round-trips;
     - a callee cannot see its caller's leftover parcels (Phase 13's nastiest
       failure mode is now impossible, and T30 proves it);
     - a name resolves DOWNWARD through the pile for reads AND writes, and
       `new note` is the only way to shadow.

   What is on trial:
   (1) SEMANTICS: visit remembers, return comes back to the row after the call,
       nesting is LIFO, parcels are FIFO within a pouch, arguments are isolated.
   (2) THE FAILURE SURFACES: every broken case is the same confused halt with pc
       PARKED on the row — empty pouch, no bookmark, deleted call row, lost flag,
       the recursion cap, and a name nobody has.
   (3) THE GESTURES + SURFACES: the prototypes drop in as real blocks, a fresh
       visit binds to the nearest flag, choosers retarget, and the pouch cards
       draw exactly what the interpreter is holding.

   Semantics go through stepInstant (synchronous — no animation to flush) over
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
// blocksBox, not document. The block lands at the end of the program.
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
  const stackEl = document.getElementById('stack');
  const paletteEl = document.getElementById('palette');
  const click = () => new window.MouseEvent('click', { bubbles:true });

  /* A subroutine that doubles what it is handed. Under Phase-14 semantics the
     caller PACKS (into the open pouch), the visit CARRIES it, and the callee
     unpacks from its own pouch:
       0 ⚑start / 1 pack 5 / 2 visit double / 3 unpack into ballX  <- comes back HERE
       4 goto done
       5 ⚑double / 6 new note n / 7 unpack into n / 8 pack n+n / 9 return
      10 ⚑done                                                              */
  const doubler = arg => [
    B.label('start'), B.pack(B.num(arg)), B.visit('double'), B.unpack('ballX'), B.goto_('done'),
    B.label('double'), B.note('n'), B.unpack('n'),
    B.pack(B.bin('+', B.v('n'), B.v('n'))), B.ret(),
    B.label('done')
  ];
  // factorial — inexpressible before Phase 14, because every depth needs its OWN n
  const factorial = (n0, withShadow) => {
    const rows = [ B.label('start'), B.pack(B.num(n0)), B.visit('factorial'),
                   B.unpack('ballX'), B.goto_('done'), B.label('factorial') ];
    if (withShadow) rows.push(B.note('n'));
    rows.push(B.unpack('n'), B.ifjump(L.cmp('<', B.v('n'), B.num(2)), 'base'),
              B.pack(B.bin('-', B.v('n'), B.num(1))), B.visit('factorial'));
    if (withShadow) rows.push(B.note('sub'));
    rows.push(B.unpack('sub'), B.pack(B.bin('*', B.v('n'), B.v('sub'))), B.ret(),
              B.label('base'), B.pack(B.num(1)), B.ret(), B.label('done'));
    return rows;
  };
  function runToAnswer(prog, cap) {
    C.load(prog); L.state.ballX = 50;
    for (let k = 0; k < (cap || 600); k++){ step(); if (L.state.ballX !== 50) break; }
    return L.state.ballX;
  }

  console.log('T1: the statements are on the shelf and render their faces');
  const stmtProtos = [...paletteEl.querySelectorAll('.stmt-tile.proto')];
  ok(stmtProtos.length === 13, '13 statement prototypes, got ' + stmtProtos.length);
  const faces = stmtProtos.map(el => el.textContent);
  ok(faces.some(t => /^visit/.test(t)), 'a visit tile');
  ok(faces.some(t => /return/.test(t)), 'a return tile');
  ok(faces.some(t => /^pack .* for the visit$/.test(t)), 'a pack tile with an expression');
  ok(faces.some(t => /^unpack into/.test(t)), 'an unpack tile with a target chip');
  ok(faces.some(t => /^new note/.test(t)), 'a new-note tile');
  const visitProto = stmtProtos.find(el => /^visit/.test(el.textContent));
  ok(visitProto.querySelector('.flagref') !== null, 'a visit carries a flagref chip, like a jump');
  ok(stmtProtos.find(el => /return/.test(el.textContent)).querySelector('.flagref') === null,
     'return carries NO chip - its destination is data, not syntax');

  console.log('T2: pack stages in the OPEN pouch; visit carries it; return brings results back');
  C.load(doubler(5));
  step();                                        // ⚑start
  step();                                        // pack 5
  ok(C.open().parcels.join() === '5', 'the parcel went to the OPEN pouch, got [' + C.open().parcels + ']');
  ok(C.mine().length === 0, 'and NOT into the pouch Beep is standing in');
  ok(C.stack().length === 0, 'no pouch pushed yet');
  step();                                        // visit double
  ok(C.stack().length === 1, 'the visit pushed a pouch');
  ok(C.mine().join() === '5', 'the open pouch BECAME the callee pouch, arguments inside');
  ok(C.open().parcels.length === 0, 'and a fresh open pouch is staged');
  ok(C.pc() === 5, 'Beep is at the flag (row 5), got ' + C.pc());
  step(); step(); step();                        // ⚑double / new note n / unpack into n
  ok(C.notesOf(1).n === 5, 'the routine unpacked its argument into its OWN note (n=' + C.notesOf(1).n + ')');
  ok(!('n' in L.state), 'and n did NOT leak into the world');
  ok(C.mine().length === 0, 'its pouch is empty again');
  step();                                        // pack n+n
  ok(C.open().parcels.join() === '10', 'the answer is packed in the callee OPEN pouch');
  step();                                        // return
  ok(C.stack().length === 0, 'the pouch was popped');
  ok(C.pc() === 3, 'came back to the row AFTER the call (3), got ' + C.pc());
  ok(C.mine().join() === '10', 'the results were delivered into the caller pouch');
  step();                                        // unpack into ballX
  ok(L.state.ballX === 10, 'the caller got the answer back (ballX=' + L.state.ballX + ')');
  ok(C.mine().length === 0 && C.open().parcels.length === 0, 'nothing left over anywhere');

  console.log('T3: parcels are FIFO within a pouch');
  C.load([ B.pack(B.num(1)), B.pack(B.num(2)), B.visit('sub'), B.goto_('end'),
           B.label('sub'), B.unpack('paddleX'), B.unpack('ballX'), B.ret(), B.label('end') ]);
  step(); step();
  ok(C.open().parcels.join() === '1,2', 'staged in packing order');
  step(); step();                                // visit sub / ⚑sub
  step();
  ok(L.state.paddleX === 1, 'the FRONT parcel came off first (got ' + L.state.paddleX + ')');
  step();
  ok(L.state.ballX === 2, 'then the next one (got ' + L.state.ballX + ')');

  console.log('T4: nesting is LIFO');
  C.load([
    B.visit('outer'),                   // 0
    B.assign('paddleX', B.num(99)),     // 1  <- outer comes back here
    B.goto_('end'),                     // 2
    B.label('outer'),                   // 3
    B.visit('inner'),                   // 4
    B.ret(),                            // 5  <- inner comes back here
    B.label('inner'),                   // 6
    B.ret(),                            // 7
    B.label('end')                      // 8
  ]);
  step(); step(); step();                        // visit outer / ⚑outer / visit inner
  ok(C.stack().length === 2, 'two pouches are open');
  step(); step();                                // ⚑inner / return
  ok(C.pc() === 5, 'the INNER return came back to row 5, got ' + C.pc());
  ok(C.stack().length === 1, 'one pouch left');
  step();                                        // return (outer)
  ok(C.pc() === 1, 'the OUTER return came back to row 1, got ' + C.pc());
  ok(C.stack().length === 0, 'the pile is empty');

  console.log('T5: recursion runs, and overflowing the pile is a WATCHABLE halt');
  C.load([ B.label('again'), B.visit('again'), B.label('end') ]);
  for (let k = 0; k < 60; k++) step();
  ok(C.stack().length === C.CALL_MAX, 'the pile stopped at the cap (' + C.CALL_MAX + '), got ' + C.stack().length);
  ok(/too many visits/.test(bubble.textContent), 'Beep says he lost track: ' + bubble.textContent);
  ok(C.pc() === 1, 'pc parked ON the visit row, got ' + C.pc());

  console.log('T6: unpacking an empty pouch stops him (and does not write)');
  C.load([ B.unpack('paddleX'), B.label('end') ]);
  L.state.paddleX = 42;
  step();
  ok(/pouch is empty/.test(bubble.textContent), 'the bubble names the problem: ' + bubble.textContent);
  ok(L.state.paddleX === 42, 'the variable was NOT written');
  ok(C.pc() === 0, 'pc parked on the unpack row, got ' + C.pc());
  step();
  ok(C.pc() === 0, 'stepping again hits the same wall - the bug is still there');

  console.log('T7: returning with no bookmark stops him too');
  C.load([ B.ret(), B.label('end') ]);
  step();
  ok(/no bookmark/.test(bubble.textContent), 'the bubble names it: ' + bubble.textContent);
  ok(C.pc() === 0, 'pc parked on the return row, got ' + C.pc());

  console.log('T8: a bookmark whose row was DELETED dangles');
  C.load([
    B.visit('sub'), B.assign('ballX', B.num(1)), B.goto_('end'),
    B.label('sub'), B.ret(), B.label('end')
  ]);
  step();
  ok(C.stack().length === 1, 'pouch pushed');
  C.dropRow(0);                                  // the learner deletes the call row mid-visit
  step(); step();                                // ⚑sub / return
  ok(/bookmark/.test(bubble.textContent) && /gone/.test(bubble.textContent),
     'Beep says his bookmark is gone: ' + bubble.textContent);
  ok(C.stack().length === 1, 'the dead pouch is KEPT, so the bug stays steppable');

  console.log('T9: a visit to a lost flag halts exactly like a lost jump');
  C.load([ B.visit('nowhere'), B.label('end') ]);
  step();
  ok(/where did it go/.test(bubble.textContent), 'the familiar lost-flag bubble: ' + bubble.textContent);
  ok(C.pc() === 0, 'pc parked on the visit row');
  ok(C.stack().length === 0, 'and no pouch was pushed');

  console.log('T10: a /0 inside a pack refuses the pack');
  C.load([ B.pack(B.bin('/', B.num(5), B.num(0))), B.label('end') ]);
  step();
  ok(C.open().parcels.length === 0, 'no parcel was made');
  ok(/does not compute/.test(bubble.textContent), 'the divide-by-zero bubble: ' + bubble.textContent);
  ok(C.pc() === 0, 'pc parked on the pack row');

  /* ---------------- Phase 14: notes and name resolution ---------------- */

  console.log('T11: a name nobody has is a confused halt, not a silent zero');
  C.load([ B.assign('ballX', B.v('mystery')), B.label('end') ]);
  L.state.ballX = 50;
  step();
  ok(/a note called mystery/.test(bubble.textContent), 'the bubble names it: ' + bubble.textContent);
  ok(L.state.ballX === 50, 'the write was refused');
  ok(C.pc() === 0, 'pc parked on the row');

  console.log('T12: writes RESOLVE DOWNWARD - no implicit shadowing');
  // the callee assigns a name the CALLER declared: it must write the caller pouch
  C.load([ B.note('tally'), B.visit('bump'), B.goto_('end'),
           B.label('bump'), B.assign('tally', B.num(7)), B.ret(), B.label('end') ]);
  // NB: a top-level `new note` declares in the WORLD pouch (index 0) - the
  // active pouch at top level IS the world. The callee is index 1.
  step(); step(); step();                        // new note tally / visit bump / ⚑bump
  ok(C.notesOf(0).tally === 0, 'the caller pouch (the world) owns tally, seeded 0');
  step();                                        // tally = 7, inside the callee
  ok(C.notesOf(0).tally === 7, 'the callee wrote THROUGH to the caller note (got ' + C.notesOf(0).tally + ')');
  ok(!('tally' in C.notesOf(1)), 'and did NOT mint a shadow in its own pouch');

  console.log('T13: a world name always means the world, from any depth');
  C.load([ B.visit('sub'), B.goto_('end'),
           B.label('sub'), B.assign('paddleX', B.num(23)), B.ret(), B.label('end') ]);
  step(); step(); step();
  ok(L.state.paddleX === 23, 'the visit moved the REAL paddle (paddleX=' + L.state.paddleX + ')');
  ok(!('paddleX' in C.notesOf(1)), 'no shadow copy was created in the pouch');

  console.log('T14: a write to a name nobody has creates it in the CURRENT pouch');
  C.load([ B.visit('sub'), B.goto_('end'),
           B.label('sub'), B.assign('fresh', B.num(4)), B.ret(), B.label('end') ]);
  step(); step(); step();
  ok(C.notesOf(1).fresh === 4, 'the note was born in the visit pouch');
  ok(!('fresh' in L.state), 'not in the world');
  step();                                        // return - the pouch dies
  ok(!('fresh' in L.state) && C.stack().length === 0, 'and it died with the pouch');

  console.log('T15: `new note` is the ONLY way to shadow, and it is per-pouch');
  C.load([ B.note('n'), B.assign('n', B.num(1)), B.visit('sub'), B.goto_('end'),
           B.label('sub'), B.note('n'), B.assign('n', B.num(2)), B.ret(), B.label('end') ]);
  step(); step(); step(); step();                // note n / n=1 / visit sub / ⚑sub
  ok(C.notesOf(0).n === 1, 'caller n (the world) is 1');
  step(); step();                                // new note n (shadow) / n = 2
  ok(C.notesOf(1).n === 2, 'callee has its OWN n = 2');
  ok(C.notesOf(0).n === 1, 'and the caller n is untouched (got ' + C.notesOf(0).n + ')');

  console.log('T16: `new note` refuses a world name');
  // a non-halt bubble is never painted by stepInstant, so ask the statement
  const refused = L.execStmt(B.note('paddleX'));
  ok(/belongs to the world/.test(refused.bubble), 'it says so: ' + refused.bubble);
  C.load([ B.visit('sub'), B.goto_('end'), B.label('sub'), B.note('paddleX'), B.ret(), B.label('end') ]);
  const paddleBefore = L.state.paddleX;          // C.load does not reset world values
  step(); step(); step();                        // visit / ⚑sub / new note paddleX
  ok(!('paddleX' in C.notesOf(1)), 'no shadow was created in the pouch');
  ok(L.state.paddleX === paddleBefore, 'and the world paddleX is untouched');

  console.log('T17: FACTORIAL - the program Phase 13 could not express');
  ok(runToAnswer(factorial(3, true)) === 6, '3! = 6');
  ok(runToAnswer(factorial(5, true)) === 120, '5! = 120');
  ok(runToAnswer(factorial(6, true)) === 720, '6! = 720');
  ok(C.stack().length === 0, 'the pile unwound completely');
  ok(C.open().parcels.length === 0, 'and nothing was left staged');
  // and the clobber the declaration prevents, kept as a LIVE demonstration
  ok(runToAnswer(factorial(5, false)) === 1,
     'without `new note` every depth shares one n and 5! comes out 1 - the clobber');

  console.log('T18: ISOLATION - a callee cannot see its caller leftovers (impossible in Phase 13)');
  C.load([ B.pack(B.num(7)), B.pack(B.num(8)), B.visit('sub'), B.goto_('end'),
           B.label('sub'), B.unpack('paddleX'), B.visit('deep'), B.ret(),
           B.label('deep'), B.unpack('ballY'), B.ret(), B.label('end') ]);
  const ballYBefore = L.state.ballY;
  step(); step(); step(); step(); step();        // pack,pack,visit sub,⚑sub,unpack->paddleX
  ok(L.state.paddleX === 7, 'sub took the first parcel (got ' + L.state.paddleX + ')');
  ok(C.mine().join() === '8', 'and still holds the leftover 8');
  step();                                        // visit deep - with an EMPTY open pouch
  ok(C.mine().length === 0, 'deep was handed an EMPTY pouch - the leftover did not follow');
  step(); step();                                // ⚑deep / unpack -> halt
  ok(/pouch is empty/.test(bubble.textContent), 'so deep halts rather than eating it: ' + bubble.textContent);
  ok(L.state.ballY === ballYBefore, 'and ballY was not written');

  console.log('T19: a callee leftover dies WITH its pouch (it cannot leak home)');
  C.load([ B.pack(B.num(1)), B.pack(B.num(2)), B.visit('sub'), B.unpack('ballX'), B.goto_('end'),
           B.label('sub'), B.unpack('paddleX'), B.pack(B.num(99)), B.ret(), B.label('end') ]);
  for (let k = 0; k < 7; k++) step();            // ...through the return
  ok(C.mine().join() === '99', 'only the RESULT came home, got [' + C.mine() + ']');
  step();
  ok(L.state.ballX === 99, 'so the caller unpacks the result (got ' + L.state.ballX + ')');

  console.log('T19b: an UNDELIVERED result queues ahead of the next one (the FIFO wrinkle)');
  // two results delivered, one consumed: the spare sits in MY pouch and is
  // first out next time - the count-agreement lesson, localized to one card
  C.load([ B.visit('two'), B.unpack('paddleX'), B.visit('one'), B.unpack('ballX'), B.goto_('end'),
           B.label('two'), B.pack(B.num(11)), B.pack(B.num(22)), B.ret(),
           B.label('one'), B.pack(B.num(33)), B.ret(), B.label('end') ]);
  for (let k = 0; k < 5; k++) step();            // visit two / ⚑two / pack / pack / return
  ok(C.mine().join() === '11,22', 'two results came home, got [' + C.mine() + ']');
  step();                                        // unpack -> paddleX (takes 11)
  ok(L.state.paddleX === 11 && C.mine().join() === '22', 'one consumed, one left over');
  for (let k = 0; k < 4; k++) step();            // visit one / ⚑one / pack 33 / return
  ok(C.mine().join() === '22,33', 'the new result queued BEHIND the leftover: [' + C.mine() + ']');
  step();
  ok(L.state.ballX === 22, 'so the stale leftover is what comes out (got ' + L.state.ballX + ')');

  console.log('T20: ifvisit takes the call only on a yes, and stages arguments the same way');
  const guarded = () => [
    B.label('top'),                                          // 0
    B.pack(B.num(3)),                                        // 1
    B.ifvisit(L.cmp('<', B.v('ballX'), B.num(50)), 'bump'),  // 2
    B.assign('paddleX', B.num(7)),                           // 3 <- comes back HERE
    B.goto_('done'),                                         // 4
    B.label('bump'), B.unpack('ballY'), B.ret(),             // 5,6,7
    B.label('done')                                          // 8
  ];
  C.load(guarded()); L.state.ballX = 10;         // yes
  step(); step(); step();
  ok(C.stack().length === 1 && C.mine().join() === '3', 'a yes carried the staged parcel in');
  step(); step(); step();                        // ⚑bump / unpack -> ballY / return
  ok(L.state.ballY === 3, 'the callee received it (ballY=' + L.state.ballY + ')');
  ok(C.pc() === 3, 'and came back after the ifvisit, got ' + C.pc());
  C.load(guarded()); L.state.ballX = 90;         // no
  step(); step(); step();
  ok(C.stack().length === 0, 'a no pushed no pouch');
  ok(C.open().parcels.join() === '3', 'and the staged parcel is still waiting, visibly');

  console.log('T21: an ifvisit to a lost flag / a /0 condition halt like everything else');
  C.load([ B.ifvisit(L.bool(true), 'nowhere'), B.label('end') ]);
  step();
  ok(/where did it go/.test(bubble.textContent), 'lost flag: ' + bubble.textContent);
  C.load([ B.ifvisit(L.cmp('<', B.bin('/', B.num(1), B.num(0)), B.num(9)), 'end'), B.label('end') ]);
  step();
  ok(/does not compute/.test(bubble.textContent), '/0 in the condition: ' + bubble.textContent);
  ok(C.stack().length === 0, 'no pouch on a poisoned condition');

  /* ---------------- the surfaces ---------------- */

  console.log('T22: the pouch cards draw what the interpreter is holding');
  C.load([ B.pack(B.num(4)), B.visit('sub'), B.goto_('end'),
           B.label('sub'), B.note('k'), B.ret(), B.label('end') ]);
  ok(stackEl.querySelectorAll('.pouch').length === 2, 'at rest: the ghost + the world');
  ok(stackEl.querySelector('.pouch.ghost') !== null, 'the open pouch renders as a ghost card');
  ok(stackEl.querySelector('.pouch.world .tile input') !== null, 'the world card has LIVE inputs');
  step();
  ok(stackEl.querySelector('.pouch.ghost .parcel') !== null, 'a packed parcel lands in the ghost card');
  step(); step(); step();                        // visit / ⚑sub / new note k
  ok(stackEl.querySelectorAll('.pouch').length === 3, 'the visit added a card');
  const topCard = stackEl.querySelector('.pouch.top');
  ok(/⚑ sub/.test(topCard.textContent), 'titled with the flag it visited');
  ok(topCard.querySelector('.ret-chip') !== null, 'and carrying its return chip');
  ok(/k/.test(topCard.textContent), 'the declared note shows on the card');
  ok(topCard.querySelector('.tile.ro') !== null, 'pouch notes render read-only (only the world is live)');

  console.log('T23: the "all in reach" view names the winner and strikes the shadowed');
  C.load([ B.note('n'), B.visit('sub'), B.goto_('end'),
           B.label('sub'), B.note('n'), B.assign('n', B.num(9)), B.ret(), B.label('end') ]);
  step(); step(); step(); step(); step();        // note n / visit / ⚑sub / note n / n=9
  C.setView('reach');
  const rows = [...stackEl.querySelectorAll('.reach-row')];
  const nRows = rows.filter(r => /^n/.test(r.querySelector('.reach-name').textContent));
  ok(nRows.length === 2, 'both n notes are listed, got ' + nRows.length);
  ok(!nRows[0].classList.contains('shadowed'), 'the nearest one wins');
  ok(nRows[1].classList.contains('shadowed'), 'the one below is struck through');
  ok(/paddleX/.test(stackEl.textContent), 'and the world is still in reach');
  C.setView('pile');
  ok(stackEl.querySelector('.pouch') !== null, 'toggling back restores the pile');

  console.log('T24: Reset clears the pile, the parcels and any invented notes');
  C.load([ B.assign('souvenir', B.num(5)), B.visit('a'), B.label('a'), B.pack(B.num(1)) ]);
  step(); step();
  ok('souvenir' in L.state, 'a top-level note was invented in the world');
  document.getElementById('btnReset').dispatchEvent(click());
  await sleep(30);
  ok(C.stack().length === 0, 'the pile is empty');
  ok(C.open().parcels.length === 0, 'nothing staged');
  ok(!('souvenir' in L.state), 'the invented note is gone');
  ok(L.state.paddleX === 40, 'and the world is back to its start values');

  /* ---------------- gestures ---------------- */

  console.log('T25: the prototypes drop in as real blocks');
  setRect(document.getElementById('tray'), 600, 0, 200, 60);
  setRect(document.getElementById('trash'), 900, 0, 74, 60);
  const rows25 = () => [...blocksBox.querySelectorAll(':scope > .block')];
  const before = rows25().length;
  await dragStmt(visitProto, 100, 300);
  ok(rows25().length === before + 1, 'the visit landed');
  const visitRow = [...blocksBox.querySelectorAll(':scope > .block.visit')].pop();
  ok(visitRow.querySelector('.flagref') && !visitRow.querySelector('.flagref.lost'),
     'and bound to a real flag: ' + visitRow.textContent.trim());
  const plainCalls = () => [...document.getElementById('wires').querySelectorAll('path.call:not(.cond)')];
  ok(plainCalls().length === 1 && plainCalls()[0].getAttribute('d'), 'its rope is drawn and dashed');

  console.log('T26: the note prototype lands and its chip renames');
  const noteProto = stmtProtos.find(el => /^new note/.test(el.textContent));
  await dragStmt(noteProto, 100, 300);
  const noteRow = [...blocksBox.querySelectorAll(':scope > .block.note')].pop();
  ok(noteRow !== undefined, 'the note row landed');
  const noteChip = noteRow.querySelector('.note-chip');
  ok(noteChip !== null, 'it carries a name chip');
  noteChip.dispatchEvent(click());
  await sleep(20);
  const pop = document.querySelector('.leaf-pop');
  ok(pop !== null && pop.querySelector('input') !== null, 'tapping it opens the name editor');
  const field = pop.querySelector('input');
  field.value = 'paddleX';                       // a world name
  field.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
  await sleep(20);
  ok(!/paddleX/.test(noteRow.textContent), 'a world name is refused, the old name kept');
  noteRow.querySelector('.note-chip').dispatchEvent(click());   // re-query: the row re-rendered
  await sleep(20);
  const field2 = document.querySelector('.leaf-pop input');
  field2.value = 'tally';
  field2.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
  await sleep(20);
  ok(/tally/.test(noteRow.textContent), 'a valid name is accepted: ' + noteRow.textContent.trim());

  console.log('T27: the unpack chooser offers notes as well as world variables');
  const unpackProto = stmtProtos.find(el => /^unpack into/.test(el.textContent));
  await dragStmt(unpackProto, 100, 300);
  const unpackRow = [...blocksBox.querySelectorAll(':scope > .block.unpack')].pop();
  unpackRow.querySelector('.tgt-chip').dispatchEvent(click());
  await sleep(20);
  const pop27 = document.querySelector('.leaf-pop');
  ok(/unpack the parcel into/.test(pop27.textContent), 'it asks the unpack question');
  const opts = [...pop27.querySelectorAll('.opt')].map(o => o.textContent);
  ok(opts.indexOf('paddleX') !== -1, 'world variables are offered');
  ok(opts.indexOf('tally') !== -1, 'and so is the note the program declares');
  [...pop27.querySelectorAll('.opt')].find(o => o.textContent === 'tally').dispatchEvent(click());
  await sleep(20);
  ok(/tally/.test(unpackRow.textContent), 'the unpack now writes into tally');

  console.log('T28: Reset restores the seed - which uses visits, and no pouch statements');
  document.getElementById('btnReset').dispatchEvent(click());
  await sleep(30);
  ok(blocksBox.querySelector('.block.visit') === null, 'the dropped visit is gone');
  ok(blocksBox.querySelector('.block.note') === null, 'the dropped note row is gone');
  ok(blocksBox.querySelector('.block.unpack') === null, 'the dropped unpack is gone');
  ok(blocksBox.querySelectorAll(':scope > .block.return').length === 2,
     'the seed keeps its 2 arrow-handler returns');
  ok(blocksBox.querySelectorAll(':scope > .block.check.callrow').length === 2, 'and its 2 ifvisit callers');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
