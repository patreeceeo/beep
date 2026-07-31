/* Phase 18 verification: sprites go everywhere numbers go.

   A note used to be a number-shaped hole. It is now DECLARED WITH A SEED, and
   the seed is the type: `new note b = ball` makes a sprite note, and from then
   on `b` is a sprite everywhere - draggable into any sprite slot, packable into
   a parcel, and refused by any slot that wants a number.

   THE LOAD-BEARING TESTS ARE T5 AND T6. T5 is the one rule the phase hangs on:
   a note's type is fixed at declaration, and BOTH writing verbs (assign and
   unpack) are refused by the SAME check in writeVar - if only one of them is
   covered, the "one rule, every verb" claim is false and a sprite can be
   smuggled into a number note through the other door. T6 is the payoff: the
   program the whole phase exists to make expressible. */
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
const popButtons = () => [...document.querySelectorAll('.leaf-pop .opt')];
const clickBtn = b => safe(b).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

(async () => {
  await sleep(60);
  const stage = document.getElementById('stage');
  Object.defineProperty(stage, 'clientWidth',  { value: 600, configurable: true });
  Object.defineProperty(stage, 'clientHeight', { value: 400, configurable: true });

  const L = window.__lang, C = window.__call, B = C.build;
  // a HIDDEN bubble says nothing: hideBubble drops the class but leaves the text,
  // so reading textContent alone would let one test's halt bleed into the next
  const bubbleEl = () => document.getElementById('bubble') || NIL();
  const bubble = () => bubbleEl().classList.contains('show') ? bubbleEl().textContent : '';
  const runTo = (n) => { for (let i = 0; i < n; i++) L.stepInstant(); };

  // ---------------------------------------------------------------
  console.log('T1: the seed IS the type declaration');
  C.load([ B.label('s'), B.note('n', L.num(0)), B.note('b', L.sprite('ball')) ]);
  await sleep(20);
  ok(L.noteType('n') === 'number', 'a note seeded with 0 is a number note');
  ok(L.noteType('b') === 'sprite', 'a note seeded with a sprite is a SPRITE note');
  ok(L.typeOf(L.v('n')) === 'number', 'and a var reading it types as number');
  ok(L.typeOf(L.v('b')) === 'sprite',  'and a var reading the sprite note types as SPRITE');
  ok(L.noteType('paddleX') === 'number', "the world's own are numbers, without a declaration");
  ok(L.noteType('nope') === 'number',
     'an undeclared name answers number - exactly what every var answered before Phase 18');

  console.log('T2: one name, one type - the declaration is the single source');
  ok(L.noteDecl('b') && L.noteDecl('b').name === 'b', 'noteDecl finds the declaring row');
  ok(L.noteDecl('paddleX') === null, 'a world variable has no declaration');
  C.load([ B.label('s'), B.note('b', L.sprite('brick2')) ]);
  await sleep(20);
  ok(L.noteType('b') === 'sprite', 'reseeding with a different sprite keeps it a sprite note');

  // ---------------------------------------------------------------
  console.log('T3: `fits` and the one polymorphic slot');
  ok(L.fits('sprite', 'any') && L.fits('number', 'any') && L.fits('boolean', 'any'),
     "an 'any' slot accepts every type");
  ok(L.fits('number', 'number') && !L.fits('sprite', 'number'),
     'every other slot still wants exactly its own type');

  C.load([ B.label('s'), B.note('b', L.num(0)) ]);
  await sleep(20);
  let noteRow = [...document.querySelectorAll('#blocksBox .block')]
                  .find(el => /new note/.test(el.textContent));
  ok(!!noteRow, 'found the declaration row');
  await tap(safe(noteRow).querySelector('.content') || NIL());
  let seedEl = safe(noteRow).querySelector('[data-sl]');
  ok(!!seedEl, 'the seed is a live slot when the row is focused');
  ok(L.expectedTypeOf(safe(seedEl).dataset.sl) === 'any',
     "with nobody reading the name, the seed slot is 'any'");

  console.log('T3b: a sprite pill drops into the seed and retypes the note');
  const spriteProtos = [...document.querySelectorAll('#palette .token.sprtok.proto')];
  ok(spriteProtos.length === 5, 'five sprite pills on the shelf');
  await dragProto(spriteProtos[0], 300, 300, seedEl ? [seedEl] : []);
  ok(L.noteType('b') === 'sprite', 'dropping a pill in the seed made it a sprite note');

  // ---------------------------------------------------------------
  console.log('T4: the seed slot PINS once the name is in use');
  C.load([ B.label('s'), B.note('b', L.num(0)), B.assign('ballX', L.v('b')) ]);
  await sleep(20);
  ok(L.noteHolders('b').length === 1, 'one var is reading the note');
  noteRow = [...document.querySelectorAll('#blocksBox .block')]
              .find(el => /new note/.test(el.textContent));
  await tap(safe(noteRow).querySelector('.content') || NIL());
  seedEl = safe(noteRow).querySelector('[data-sl]');
  ok(L.expectedTypeOf(safe(seedEl).dataset.sl) === 'number',
     'the slot has pinned to number - retyping would ill-type the var reading it');
  await dragProto(spriteProtos[0], 300, 300, seedEl ? [seedEl] : []);
  ok(L.noteType('b') === 'number', 'so the sprite pill is refused, and the note stays a number note');
  ok(L.noteHolders('nobody').length === 0, 'noteHolders finds nothing for an unread name');

  // ---------------------------------------------------------------
  console.log('T5: ONE type check, and BOTH writing verbs go through it');
  // assign: a sprite into a number note
  C.load([ B.label('s'), B.note('n', L.num(0)), B.assign('n', L.sprite('ball')) ]);
  await sleep(20);
  runTo(3);
  ok(/holds a number, not a sprite/.test(bubble()),
     'assign of a sprite into a number note is REFUSED, and Beep says why');
  ok(C.pc() === 2, 'and pc parks on the offending row, so the bug is steppable');
  ok(L.typeOf(L.v('n')) === 'number', 'the note kept its type');

  // unpack: the same value arriving through the OTHER door
  C.load([ B.label('s'), B.note('n', L.num(0)), B.pack(L.sprite('ball')), B.visit('f'),
           B.goto_('end'), B.label('f'), B.unpack('n'), B.ret(), B.label('end') ]);
  await sleep(20);
  runTo(8);
  ok(/holds a number, not a sprite/.test(bubble()),
     'and unpacking a sprite parcel into a number note is refused by the SAME check');
  ok(C.pc() === 6, 'pc parks on the unpack row');
  // the regression: a refusal must leave the world as it found it, or the
  // parcel is gone by the time the learner fixes the note and steps again
  ok(C.mine().length === 1 && C.mine()[0] === 'ball',
     'and the REFUSED unpack left the parcel in the pouch, not eaten');
  runTo(2);
  ok(/holds a number, not a sprite/.test(bubble()),
     'so re-stepping still reports the type clash, not an empty pouch');

  // the legal direction still works
  C.load([ B.label('s'), B.note('b', L.sprite('ball')), B.assign('b', L.sprite('brick3')) ]);
  await sleep(20);
  runTo(3);
  ok(!/holds a/.test(bubble()), 'a sprite into a SPRITE note is fine');
  // a top-level `new note` declares into the ACTIVE pouch, which at top level
  // IS the world - so a world note it is, visible and inspectable (Phase 14)
  ok(C.notesOf(0).b === 'brick3', 'and the write landed: the note now holds brick3');

  // ---------------------------------------------------------------
  console.log('T6: the payoff - pack a sprite, visit, unpack it, despawn it');
  C.load([
    B.label('start'),
    B.pack(L.sprite('brick1')), B.visit('hit'),
    B.pack(L.sprite('brick2')), B.visit('hit'),
    B.goto_('done'),
    B.label('hit'),
    B.note('b', L.sprite('ball')),      // the seed declares the TYPE, not the value
    B.unpack('b'),
    B.despawn(L.v('b')),                // despawn whatever the note holds
    B.ret(),
    B.label('done')
  ]);
  await sleep(20);
  ok(L.spriteAlive.brick1 && L.spriteAlive.brick2, 'both bricks start alive');
  runTo(16);                            // exactly one pass: start -> done
  ok(L.spriteAlive.brick1 === false, 'brick1 was despawned through the note');
  ok(L.spriteAlive.brick2 === false, 'and brick2 by the SAME routine, with a different parcel');
  ok(L.spriteAlive.paddle === true, 'nothing else was touched');
  ok(C.stack().length === 0 && C.open().parcels.length === 0,
     'clean unwind: no pouches left, nothing staged');

  // ---------------------------------------------------------------
  console.log('T7: a parcel carries a sprite, and reads as one');
  C.load([ B.label('s'), B.pack(L.sprite('brick1')), B.pack(L.num(7)) ]);
  await sleep(20);
  runTo(3);
  ok(C.open().parcels.length === 2, 'two parcels staged');
  ok(C.open().parcels[0] === 'brick1', 'a sprite parcel is its NAME - no tagging needed');
  ok(L.valueType(C.open().parcels[0]) === 'sprite'
     && L.valueType(C.open().parcels[1]) === 'number',
     'and valueType recovers each type from the value itself');
  const parcelHtml = (document.getElementById('stack') || NIL()).innerHTML;
  ok(/class="token sprtok mini"/.test(parcelHtml), 'the sprite parcel wears the coral pill');

  console.log('T7b: pack takes anything; a number slot still does not');
  C.load([ B.label('s'), B.pack(L.num(0)) ]);
  await sleep(20);
  const packRow = [...document.querySelectorAll('#blocksBox .block')]
                    .find(el => /pack/.test(el.textContent));
  await tap(safe(packRow).querySelector('.content') || NIL());
  const packSlot = safe(packRow).querySelector('[data-sl]');
  ok(L.expectedTypeOf(safe(packSlot).dataset.sl) === 'any', "pack's slot is 'any'");
  await dragProto(spriteProtos[2], 300, 300, packSlot ? [packSlot] : []);
  const packRow2 = [...document.querySelectorAll('#blocksBox .block')]
                     .find(el => /pack/.test(el.textContent));
  ok(/brick1/.test(safe(packRow2).textContent), 'a sprite pill drops straight into pack');

  // ---------------------------------------------------------------
  console.log('T8: a declared note gets a palette tile, automatically');
  C.load([ B.label('s'), B.note('cnt', L.num(0)), B.note('who', L.sprite('ball')) ]);
  await sleep(30);
  const noteTiles = () => [...document.querySelectorAll('#palette [data-note]')];
  ok(noteTiles().length === 2, 'two note tiles appeared, one per declaration');
  const whoTile = noteTiles().find(t => t.dataset.note === 'who');
  const cntTile = noteTiles().find(t => t.dataset.note === 'cnt');
  ok(safe(whoTile).className.includes('sprtok'), 'the sprite note wears the coral pill');
  ok(safe(cntTile).className.includes('var') && !safe(cntTile).className.includes('sprtok'),
     'the number note wears the teal box');

  console.log('T8b: and it drags into a sprite slot like any other pill');
  C.load([ B.label('s'), B.note('who', L.sprite('ball')), B.despawn('brick1') ]);
  await sleep(30);
  const despRow = [...document.querySelectorAll('#blocksBox .block')]
                    .find(el => /despawn/.test(el.textContent));
  await tap(safe(despRow).querySelector('.content') || NIL());
  const despSlot = safe(despRow).querySelector('[data-sl]');
  const whoTile2 = [...document.querySelectorAll('#palette [data-note]')]
                     .find(t => t.dataset.note === 'who');
  ok(!!whoTile2, 'the note tile is on the shelf');
  await dragProto(whoTile2, 300, 300, despSlot ? [despSlot] : []);
  const despRow2 = [...document.querySelectorAll('#blocksBox .block')]
                     .find(el => /despawn/.test(el.textContent));
  ok(/who/.test(safe(despRow2).textContent), 'dropping it makes `despawn who`');
  runTo(4);
  ok(L.spriteAlive.ball === false, 'and running it despawns whatever the note HOLDS (the ball)');

  console.log('T8c: a number note is refused by a sprite slot');
  C.load([ B.label('s'), B.note('cnt', L.num(0)), B.despawn('brick1') ]);
  await sleep(30);
  const despRow3 = [...document.querySelectorAll('#blocksBox .block')]
                     .find(el => /despawn/.test(el.textContent));
  await tap(safe(despRow3).querySelector('.content') || NIL());
  const despSlot3 = safe(despRow3).querySelector('[data-sl]');
  const cntTile2 = [...document.querySelectorAll('#palette [data-note]')]
                     .find(t => t.dataset.note === 'cnt');
  await dragProto(cntTile2, 300, 300, despSlot3 ? [despSlot3] : []);
  const despRow4 = [...document.querySelectorAll('#blocksBox .block')]
                     .find(el => /despawn/.test(el.textContent));
  ok(/brick1/.test(safe(despRow4).textContent) && !/cnt/.test(safe(despRow4).textContent),
     'the number note never reaches the sprite slot');

  // ---------------------------------------------------------------
  console.log('T9: a var whose declaration is gone FRAYS (Phase-9 amendment, 4th instance)');
  C.load([ B.label('s'), B.note('tmp', L.num(0)), B.assign('ballX', L.v('tmp')) ]);
  await sleep(20);
  ok(L.varLost('tmp') === false, 'while declared, the var is fine');
  ok(L.varLost('paddleX') === false, 'a world variable is never lost');
  C.dropRow(1);                                  // delete the declaration behind Beep's back
  await sleep(20);
  ok(L.varLost('tmp') === true, 'with the declaration gone, the name is lost');
  const asgRow = [...document.querySelectorAll('#blocksBox .block')]
                   .find(el => /ballX/.test(el.textContent));
  ok(/class="chip lost"/.test(safe(asgRow).innerHTML), 'and the chip renders frayed');
  ok([...document.querySelectorAll('#palette [data-note]')].length === 0,
     'its palette tile went away with it');
  runTo(3);
  ok(/do not have one/.test(bubble()), 'at run time Beep halts on the dangling read');

  // ---------------------------------------------------------------
  console.log('T10: retargeting an assign across types swaps in the identity');
  C.load([ B.label('s'), B.note('who', L.sprite('ball')),
           B.assign('ballX', L.bin('+', L.v('ballX'), L.num(4))) ]);
  await sleep(30);
  const trayEl = document.getElementById('tray');
  const trayBefore = trayEl.children.length;
  const asg = [...document.querySelectorAll('#blocksBox .block')]
                .find(el => /ballX/.test(el.textContent));
  await tap(safe(asg).querySelector('.tgt-chip') || NIL());
  const whoBtn = popButtons().find(b => b.textContent === 'who');
  ok(!!whoBtn, 'the LHS chooser offers the declared note, with no new code');
  clickBtn(whoBtn);
  await sleep(30);
  const asg2 = [...document.querySelectorAll('#blocksBox .block')]
                 .find(el => el.querySelector('.tgt-chip'));
  ok(/who\b[\s\S]*who/.test(safe(asg2).textContent),
     'the RHS became `who` - the new target\'s identity read, so behaviour is unchanged');
  ok(trayEl.children.length === trayBefore + 1,
     'and the displaced expression retreated to the spare tiles - material never lost');

  console.log('T10b: a same-type retarget keeps the work');
  C.load([ B.label('s'), B.assign('ballX', L.bin('+', L.v('ballX'), L.num(4))) ]);
  await sleep(30);
  const trayBefore2 = trayEl.children.length;
  const asg3 = [...document.querySelectorAll('#blocksBox .block')]
                 .find(el => /ballX/.test(el.textContent));
  await tap(safe(asg3).querySelector('.tgt-chip') || NIL());
  clickBtn(popButtons().find(b => b.textContent === 'ballY'));
  await sleep(30);
  const asg4 = [...document.querySelectorAll('#blocksBox .block')]
                 .find(el => /ballY/.test(el.textContent));
  ok(/\+/.test(safe(asg4).textContent), 'number -> number keeps the expression');
  ok(trayEl.children.length === trayBefore2, 'and nothing went to the spares');

  // ---------------------------------------------------------------
  console.log('T11: the seed is an ordinary expression, and fails the ordinary ways');
  C.load([ B.label('s'), B.note('n', L.bin('/', L.num(4), L.num(0))) ]);
  await sleep(20);
  runTo(2);
  ok(/does not compute/.test(bubble()), 'a /0 in the seed refuses the declaration');
  ok(C.pc() === 1, 'pc parks on the declaration row');

  C.load([ B.label('s'), B.note('n', L.v('ghost')) ]);
  await sleep(20);
  runTo(2);
  ok(/do not have one/.test(bubble()), 'and a missing name in the seed refuses it too');

  console.log('T11b: the seed VALUE, not just its type, reaches the note');
  C.load([ B.label('s'), B.note('n', L.bin('+', L.num(40), L.num(2))) ]);
  await sleep(20);
  runTo(2);
  ok(C.notesOf(0).n === 42, 'the note was seeded with the seed expression\'s value');

  // ---------------------------------------------------------------
  console.log('T12: Reset restores the declaration and its seed (the T13b lesson)');
  C.load([ B.label('s'), B.note('b', L.sprite('ball')) ]);
  await sleep(20);
  document.getElementById('btnReset').click();
  await sleep(40);
  ok(document.querySelectorAll('#blocksBox .block').length > 20,
     'Reset restored the seed PROGRAM (the loaded one is gone)');
  ok([...document.querySelectorAll('#palette [data-note]')].length === 0,
     'and the note tile went with it');

  /* T12b: cloneStmt must DEEP-clone the seed. This is the Phase-15 T13b lesson
     applied to notes: a shared seed node means editing one copy silently edits
     the other - and, at init, corrupts the programSeed snapshot Reset restores
     from. Duplicate the row, edit ONE copy's seed, and the other must not move. */
  console.log('T12b: cloneStmt deep-clones the seed (the Phase-15 shared-node hazard)');
  C.load([ B.label('s'), B.note('b', L.sprite('ball')) ]);
  await sleep(30);
  const dupTarget = [...document.querySelectorAll('#blocksBox .block')]
                      .find(el => /new note/.test(el.textContent));
  safe(dupTarget).querySelector('.grip').dispatchEvent(pev('pointerdown', 50, 100));
  document.getElementById('blocksBox').dispatchEvent(pev('pointerup', 50, 100));
  await sleep(30);
  const dupBtn = popButtons().find(b => b.textContent === 'duplicate');
  ok(!!dupBtn, 'the grip menu offers duplicate');
  clickBtn(dupBtn);
  await sleep(30);
  const noteRows = [...document.querySelectorAll('#blocksBox .block')]
                     .filter(el => /new note/.test(el.textContent));
  ok(noteRows.length === 2, 'there are two declaration rows now');
  ok(/ball/.test(safe(noteRows[0]).textContent) && /ball/.test(safe(noteRows[1]).textContent),
     'both seeded with ball');
  /* The edit has to be IN PLACE. Dragging a fresh pill in REPLACES the node
     reference on one statement, so a shared seed would never show; tapping the
     pill and picking another sprite mutates `node.name` on the node itself,
     which is exactly the edit Phase 15's T13b used to catch a shared clone. */
  await tap(safe(noteRows[0]).querySelector('.content') || NIL());
  const pill = safe(noteRows[0]).querySelector('.token.sprtok[data-sl]');
  ok(!!pill, 'the seed renders as a tappable sprite pill');
  await tap(safe(pill));
  const brickBtn = popButtons().find(b => b.textContent === 'brick1');
  ok(!!brickBtn, 'the sprite chooser opened on it');
  clickBtn(brickBtn);
  await sleep(30);
  const after = [...document.querySelectorAll('#blocksBox .block')]
                  .filter(el => /new note/.test(el.textContent));
  ok(/brick1/.test(safe(after[0]).textContent), 'the edited row now seeds brick1');
  /* Read the OTHER row the way a learner would - focus it, which re-renders it
     from its own AST. Reading its stale DOM instead would pass even with a
     shared seed node, which is how this test first failed to catch that. */
  await tap(safe(after[1]).querySelector('.content') || NIL());
  const other = [...document.querySelectorAll('#blocksBox .block')]
                  .filter(el => /new note/.test(el.textContent))[1];
  ok(/ball/.test(safe(other).textContent) && !/brick1/.test(safe(other).textContent),
     'and the OTHER row still seeds ball - the seed was deep-cloned, not shared');

  // ---------------------------------------------------------------
  /* T13: `empty the pouch I am packing` - the repair verb. Before it, a program
     that staged parcels and never took them anywhere had NO way back: the pile
     was visible but nothing short of Reset could clear it. */
  console.log('T13: emptying the staging pouch');
  C.load([ B.label('s'), B.pack(L.num(1)), B.pack(L.num(2)), B.empty() ]);
  await sleep(20);
  runTo(3);
  ok(C.open().parcels.length === 2, 'two parcels staged');
  runTo(1);
  ok(C.open().parcels.length === 0, 'and the row tipped them out');

  /* The wording is checked through execStmt rather than by stepping: stepInstant
     is the instant path and never paints a bubble, so reading the on-screen one
     would be reading whatever the previous test left behind. */
  console.log('T13b: what Beep says, including the visible no-op');
  C.load([ B.label('s'), B.pack(L.num(1)), B.pack(L.num(2)) ]);
  await sleep(20);
  runTo(3);
  ok(/tipped out 2 parcels/.test(L.execStmt(B.empty()).bubble), 'he counts what he dropped');
  ok(C.open().parcels.length === 0, 'and the pouch is bare afterwards');
  ok(/already bare/.test(L.execStmt(B.empty()).bubble),
     'on an empty pouch it SAYS so rather than pretending to work');
  // stage exactly one, to check the singular wording
  L.execStmt(B.pack(L.num(1)));
  ok(C.open().parcels.length === 1, 'one parcel staged');
  ok(/tipped out 1 parcel\b/.test(L.execStmt(B.empty()).bubble), 'and it counts one parcel singly');

  console.log('T13c: it leaves the ACTIVE pouch alone - those are my arguments');
  C.load([ B.label('s'), B.note('n', L.num(0)), B.pack(L.num(9)), B.visit('f'),
           B.goto_('end'), B.label('f'), B.empty(), B.unpack('n'), B.ret(), B.label('end') ]);
  await sleep(20);
  runTo(6);                              // through the empty row, inside the call
  ok(C.mine().length === 1 && C.mine()[0] === 9,
     'the argument this visit was handed is untouched');
  runTo(1);
  ok(C.notesOf(0).n === 9, 'so it still unpacks');

  /* T13d: the claim the verb is FOR. After a completed call the staging pouch
     is fresh - `return` delivers into the CALLER's active pouch, never the
     staging one - so `empty` on the taken path is exactly a no-op, and on the
     not-taken path it is exactly the cleanup. Both paths, one row. */
  console.log('T13d: no-op when the ifvisit fires, cleanup when it does not');
  const guarded = (yes) => [
    B.label('s'),
    B.note('n', L.num(0)),               // a WORLD note, so it survives the return
    B.pack(L.num(5)),
    B.ifvisit(L.bool(yes), 'f'),
    B.empty(),
    B.goto_('end'),
    B.label('f'), B.unpack('n'), B.pack(L.num(99)), B.ret(),
    B.label('end')
  ];
  C.load(guarded(true));
  await sleep(20);
  runTo(8);
  ok(C.notesOf(0).n === 5, 'YES path: the callee got its argument');
  ok(C.mine().join() === '99', 'and its result came home to the caller');
  runTo(1);                              // the empty row, back in the caller
  ok(C.mine().join() === '99',
     'the empty row did NOT touch the returned result - it is a no-op here');

  C.load(guarded(false));
  await sleep(20);
  runTo(4);
  ok(C.open().parcels.join() === '5', 'NO path: the argument is left staged...');
  runTo(1);
  ok(C.open().parcels.length === 0, '...and the empty row clears it');

  console.log('T13e: without it, the stale argument poisons the NEXT visit');
  C.load([
    B.label('s'),
    B.note('n', L.num(0)),
    B.pack(L.num(5)),
    B.ifvisit(L.bool(false), 'f'),       // does NOT fire; 5 stays staged
    B.pack(L.num(7)),
    B.visit('f'),
    B.goto_('end'),
    B.label('f'), B.unpack('n'), B.ret(),
    B.label('end')
  ]);
  await sleep(20);
  runTo(8);
  ok(C.notesOf(0).n === 5,
     "the second visit unpacked 5 - the FIRST call's stale argument, not its own 7");

  console.log('T13f: the verb is on the shelf and drags in like any statement');
  const emptyProto = [...document.querySelectorAll('#palette .stmt-tile.proto')]
                       .find(el => /empty the pouch/.test(el.textContent));
  ok(!!emptyProto, 'the shelf carries it');
  ok(safe(emptyProto).className.includes('pack'),
     'and it wears the pack family colour - it acts on the pouch being packed');
  ok(!/data-sl/.test(safe(emptyProto).innerHTML), 'it is slotless, like return');

  /* Slotless statements are the easy ones to get wrong in cloneStmt: `return`
     and `empty` differ only by their type string, so a copy-paste there yields
     a duplicate that silently becomes the OTHER verb. Duplicate the row and
     read it back. */
  console.log('T13g: cloneStmt keeps an empty row an empty row');
  C.load([ B.label('s'), B.empty() ]);
  await sleep(30);
  const emptyRow = [...document.querySelectorAll('#blocksBox .block')]
                     .find(el => /empty the pouch/.test(el.textContent));
  ok(!!emptyRow, 'the row is in the program');
  safe(emptyRow).querySelector('.grip').dispatchEvent(pev('pointerdown', 50, 100));
  document.getElementById('blocksBox').dispatchEvent(pev('pointerup', 50, 100));
  await sleep(30);
  clickBtn(popButtons().find(b => b.textContent === 'duplicate'));
  await sleep(30);
  const emptyRows = [...document.querySelectorAll('#blocksBox .block')]
                      .filter(el => /empty the pouch/.test(el.textContent));
  ok(emptyRows.length === 2, 'the duplicate is an EMPTY row, not a return');
  ok(!document.querySelector('#blocksBox .block.return'), 'and no return row appeared');

  // ---------------------------------------------------------------
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
