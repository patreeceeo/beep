/* The event SCHEDULER — Phase 22a.

   What this phase built is the machinery that visits scripts, and nothing else.
   WHAT the engine visits with (the overlap vector, spawn/despawn, scene `start`)
   is 22b; WHO drives the tick in the UI is 22d/23. So every assertion here goes
   through `window.__evt`, and the clock never appears: `tick()` is called
   directly, statement by statement, and there is no rAF anywhere in this file.
   That is deliberate and it is the phase's keystone — a scheduler that can only
   be observed by watching an animation is a scheduler that cannot be tested.

   What is on trial:
   (1) DELIVERY. An event is the Phase-14 machinery, engine-initiated: a pouch
       staged with the event's parcels already inside, pushed with `ret: SYSTEM`,
       pc set to the label. A handler unpacks its arguments exactly as any visit
       does, and one that does not care never unpacks.
   (2) RUN TO COMPLETION. A handler runs to its return before the next event
       reaches that instance. An event arriving mid-handler waits in that
       context's OWN queue.
   (3) THE SYSTEM RETURN, and its discard. There is no caller, so undelivered
       results die with the frame rather than landing in somebody else's pouch.
   (4) THE IMPLICIT END. Falling off the end of a script is a return —
       wrap-to-top is gone — while an EXPLICIT `return` with no bookmark is
       still the `nostack` halt. The two must not be conflated.
   (5) THE TICK: fixed order, scene first, then on-scene instances in
       SCENE-ENTRY order, each running to completion before the next dispatches.
   (6) THE BUDGET. An infinite loop is a teachable failure, not a hang. */
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
function click(){ return new window.MouseEvent('click', { bubbles:true }); }

(async () => {
  await sleep(50);
  const E = window.__evt;
  const X = window.__ctx;
  const L = window.__lang;
  const C = window.__call;
  const B = C.build;
  const bubble = document.getElementById('bubble');
  const blocksBox = document.getElementById('blocksBox');

  /* Build the world the way every other suite does: reset, then step the seed's
     setup rows (everything above `start`) so the five instances exist and are
     on the scene in the seed's order. */
  /* `extraRows` are appended BELOW the seed, after the reset and before the
     setup rows run - which is the only order that works, because Reset restores
     the program from `programSeed` and would otherwise wipe them. Everything
     goes below `start`, so the setup rows above it are untouched. */
  async function freshWorld(extraRows){
    document.getElementById('btnReset').dispatchEvent(click());
    await sleep(40);
    if (extraRows && extraRows.length) C.load(L.program().concat(extraRows));
    const startAt = [...blocksBox.querySelectorAll(':scope > .block')]
      .findIndex(r => /start/.test(r.textContent) && /⚑/.test(r.textContent));
    for (let i = 0; i < startAt; i++) L.stepInstant();
    E.resetTicks();
  }
  // the scene's own `simulate` handler: it zeroes the running number, which is
  // how the order tests know the scene went before any instance
  const sceneSimulate = () => [ B.label('simulate'), assign('order', B.num(0)), B.ret() ];
  // clear every class script, so one test's handlers cannot leak into the next
  function silence(){ L.classNames().forEach(n => E.setScript(n, [])); }
  const ctxOf = name => X.of(L.state[name]);
  // one statement of a context, exactly as runToCompletion runs it
  function stepIn(ctx){
    return X.runIn(ctx, function(){
      const i = ctx.pc, b = ctx.script[i];
      const r = b.exec();
      return { r: r, t: L.nextPc(i, r) };
    });
  }
  // a context's handler frame, or a harmless stand-in - so a mutant that fails
  // to push one reports FAILED ASSERTIONS rather than crashing the suite
  const frameOf = ctx => ctx.pouches[1] || { parcels:[], notes:{}, ret:null };
  const assign = (name, expr) => B.assign(name, expr);
  const inc = name => assign(name, B.bin('+', B.v(name), B.num(1)));

  await freshWorld();
  silence();

  console.log('T1: an event is a staged pouch pushed with SYSTEM at the bottom');
  E.setScript('Ball', [ B.label('simulate'), inc('ballX'), B.ret() ]);
  const ball = ctxOf('ball');
  ok(!!ball, 'the ball has a context');
  ok(E.idle(ball), 'and it starts at REST - nothing is part-way through');
  ok(ball.pouches.length === 1, 'just its own base pouch, no frames');
  const sent = E.dispatch(ball, 'simulate', []);
  ok(sent === true, 'dispatching `simulate` finds the label and goes out');
  ok(ball.pouches.length === 2, 'it pushed exactly one frame, got ' + ball.pouches.length);
  const frame = ball.pouches[1] || {};
  ok(frame.ret === E.SYSTEM, 'MUTANT: the frame`s `ret` is the SYSTEM sentinel');
  ok(ball.script.indexOf(E.SYSTEM) === -1,
     'and SYSTEM is NOT a row - nothing that walks rows can mistake it for one');
  ok(frame.label === ball.script[0], 'the frame is labelled with the handler it entered');
  ok(ball.pc === 0, 'pc is on the label, got ' + ball.pc);
  ok(!E.idle(ball), 'and the context is no longer at rest');
  E.runToCompletion(ball);

  console.log('T2: the parcels ride in the pouch, and unpack takes them as any visit does');
  await freshWorld(); silence();
  E.setScript('Ball', [ B.label('simulate'),
                        B.note('ox', B.num(0)), B.note('oy', B.num(0)),
                        B.unpack('ox'), B.unpack('oy'), B.ret() ]);
  const b2 = ctxOf('ball');
  E.dispatch(b2, 'simulate', [7, 9]);
  ok(frameOf(b2).parcels.join(',') === '7,9',
     'the event`s parcels were already INSIDE the pouch when it arrived, got ' + frameOf(b2).parcels);
  for (let i = 0; i < 5; i++) stepIn(b2);          // label, two notes, two unpacks
  const handlerNotes = frameOf(b2).notes;
  ok(handlerNotes.ox === 7 && handlerNotes.oy === 9,
     'the handler unpacked them in order, ox=7 oy=9, got ' + JSON.stringify(handlerNotes));
  ok(frameOf(b2).parcels.length === 0, 'and the pouch is empty afterwards');
  E.runToCompletion(b2);

  console.log('T3: a handler that does not care never unpacks - the leftovers die with the frame');
  await freshWorld(); silence();
  E.setScript('Paddle', [ B.label('simulate'), inc('paddleX'), B.ret() ]);
  const pad = ctxOf('paddle');
  const padX = L.state.paddleX;
  ok(E.runEvent(pad, 'simulate', [111, 222]) === 'ran',
     'a handler with no unpack runs to completion regardless');
  ok(L.state.paddleX === padX + 1, 'and did its work, got ' + L.state.paddleX);
  ok(pad.pouches.length === 1, 'the frame - parcels and all - is gone');
  ok(pad.pouches[0].parcels.length === 0,
     'MUTANT: and the two it never unpacked did NOT fall into its base pouch');

  console.log('T4: THE SYSTEM RETURN - the frame pops, the context rests, results are DISCARDED');
  await freshWorld(); silence();
  E.setScript('Ball', [ B.label('simulate'), B.pack(B.num(42)), B.ret() ]);
  const b4 = ctxOf('ball');
  const sceneParcelsBefore = X.scene().pouches[0].parcels.length;
  ok(E.runEvent(b4, 'simulate', []) === 'ran', 'the handler ran to its return');
  ok(b4.pouches.length === 1, 'the SYSTEM frame popped, got ' + b4.pouches.length);
  ok(E.idle(b4), 'and the context is at rest again');
  ok(b4.pouches[0].parcels.length === 0,
     'MUTANT: the 42 it packed went NOWHERE - there is no caller to receive it');
  ok(b4.open.parcels.length === 0, 'and the staging pouch was replaced, not carried over');
  ok(X.scene().pouches[0].parcels.length === sceneParcelsBefore,
     'MUTANT: nothing leaked into the scene either - contexts do not share results');

  console.log('T5: one handler`s leftovers can never become another`s arguments');
  await freshWorld(); silence();
  E.setScript('Ball',   [ B.label('simulate'), B.pack(B.num(42)), B.ret() ]);
  E.setScript('Paddle', [ B.label('simulate'), B.note('got', B.num(0)), B.unpack('got'), B.ret() ]);
  E.runEvent(ctxOf('ball'), 'simulate', []);
  const padRan = E.runEvent(ctxOf('paddle'), 'simulate', []);
  ok(padRan === 'stopped', 'the paddle`s unpack found an EMPTY pouch and stopped');
  ok(/empty/.test(bubble.textContent),
     'MUTANT: "my pouch is empty" - the ball`s 42 never reached it, got ' + bubble.textContent);

  console.log('T6: RUN TO COMPLETION - an event arriving mid-handler waits in that context`s queue');
  await freshWorld(); silence();
  E.setScript('Ball', [ B.label('simulate'), inc('ballX'), inc('ballX'), B.ret() ]);
  const b6 = ctxOf('ball'), pad6 = ctxOf('paddle');
  const x0 = L.state.ballX;
  E.dispatch(b6, 'simulate', []);                 // now part-way through
  stepIn(b6);                                     // ran the label only
  ok(!E.idle(b6), 'the ball is part-way through its handler');
  ok(E.deliver(b6, 'simulate', []) === 'queued',
     'MUTANT: a second `simulate` does NOT interrupt it - it queues');
  ok(E.queue(b6).length === 1, 'one event waiting, got ' + E.queue(b6).length);
  ok(E.queue(pad6).length === 0, 'and the queue is PER CONTEXT - the paddle`s is untouched');
  ok(b6.pouches.length === 2, 'no second frame was pushed while the first was live');
  E.runToCompletion(b6);
  ok(L.state.ballX === x0 + 4, 'both handlers ran, in order, twice +2, got ' + (L.state.ballX - x0));
  ok(E.queue(b6).length === 0 && E.idle(b6), 'the queue drained and the context came to rest');

  console.log('T7: a missing label is UNSUBSCRIBING - no event, and no halt');
  await freshWorld(); silence();
  E.setScript('Ball', [ B.label('somethingElse'), inc('ballX') ]);
  const b7 = ctxOf('ball');
  bubble.textContent = '';
  ok(E.dispatch(b7, 'simulate', []) === false, 'dispatch answers false - there is no such door');
  ok(E.runEvent(b7, 'simulate', []) === 'nolabel', 'and runEvent reports nolabel');
  ok(E.idle(b7) && b7.pouches.length === 1, 'the context never moved');
  ok(bubble.textContent === '', 'MUTANT: and Beep is NOT confused - a script with no handler just holds still');

  console.log('T8: falling off the end of a script is an IMPLICIT RETURN, not a wrap to the top');
  await freshWorld(); silence();
  // no `return` row at all: the handler simply runs out of script
  E.setScript('Ball', [ B.label('simulate'), inc('ballX') ]);
  const b8 = ctxOf('ball');
  const x8 = L.state.ballX;
  ok(E.runEvent(b8, 'simulate', []) === 'ran', 'a handler with no return still finishes');
  ok(L.state.ballX === x8 + 1,
     'MUTANT: and ran its one statement EXACTLY once - it did not wrap to the top and loop');
  ok(b8.pouches.length === 1 && E.idle(b8), 'the frame popped and the context rests');

  console.log('T9: at the ROOT, running out of script is simply the end - not the `nostack` halt');
  const root = X.makeCtx([ B.label('a'), inc('ballX') ], null);
  ok(root.pouches.length === 1, 'a context with no frames of its own');
  /* It has to be RUNNING for this to mean anything. A context that was already
     at rest would report "at rest" afterwards whatever the rule was, and the
     assertion would pass against a version that treats the end of a script as
     the `nostack` HALT - which is the mutant this test exists to kill. Stand
     where the two answers differ: running, and reading what nextPc ANSWERS. */
  root.pc = 0; root.idle = false;
  stepIn(root);
  const last = stepIn(root);
  ok(last.t === null,
     'MUTANT: running out of rows answers "just carry on", NOT a halt code, got ' + last.t);
  ok(root.idle === true, 'MUTANT: and the context came to rest');
  ok(root.pc === 1, 'MUTANT: pc parked on the last row, NOT wrapped round to 0, got ' + root.pc);
  // and the explicit form is still an error, which is the distinction that matters
  const halt = X.runIn(root, function(){ root.pc = 0; return L.nextPc(0, { ret:true }); });
  ok(halt === 'nostack',
     'MUTANT: but an EXPLICIT `return` with no bookmark is still the halt, got ' + halt);

  console.log('T10: THE TICK visits the scene first, then on-scene instances in SCENE-ENTRY order');
  /* Each handler folds its own digit onto a running number, so ONE assertion
     pins the order AND that everybody ran exactly once. */
  await freshWorld(sceneSimulate()); silence();
  L.state.order = -1;
  const digit = d => assign('order', B.bin('+', B.bin('*', B.v('order'), B.num(10)), B.num(d)));
  E.setScript('Brick',  [ B.label('simulate'), digit(1), B.ret() ]);
  E.setScript('Ball',   [ B.label('simulate'), digit(2), B.ret() ]);
  E.setScript('Paddle', [ B.label('simulate'), digit(3), B.ret() ]);
  const entry = E.order();
  ok(entry.length === 5, 'five instances on the scene, got ' + entry.length);
  E.tick();
  ok(L.state.order === 11123,
     'scene(0) then brick,brick,brick,ball,paddle = 11123, got ' + L.state.order);
  ok(E.ticks() === 1, 'and that was one tick');

  console.log('T11: scene-entry order is ARRIVAL order, not minting order');
  /* The mutant this kills is iterating the `instances` map, which is keyed in
     MINTING order. For the seed the two agree, so they have to be pulled apart:
     taking brick1 off the scene and putting it back sends it to the BACK of the
     queue while leaving it first in the map. */
  const brick1 = L.state.brick1;
  L.removeFromScene(brick1); L.addToScene(brick1);
  ok(E.order()[4] === brick1, 'brick1 re-entered last, so it is last in scene order');
  ok(Object.keys(L.instances)[0] === brick1, 'but it is still FIRST in the instances map');
  L.state.order = -1;
  E.tick();
  ok(L.state.order === 11231,
     'MUTANT: the tick followed ARRIVAL order - brick1 last, got ' + L.state.order);

  console.log('T12: a script with no `simulate` label does not end the tick - it just stands there');
  await freshWorld(sceneSimulate()); silence();
  L.state.order = -1;
  E.setScript('Ball', [ B.label('simulate'), digit(2), B.ret() ]);   // Wall-like: bricks/paddle silent
  E.tick();
  ok(L.state.order === 2,
     'MUTANT: the three silent Bricks did not stop the tick reaching the ball, got ' + L.state.order);

  console.log('T13: THE BUDGET turns an infinite loop into a teachable stop');
  await freshWorld(); silence();
  L.state.spin = 0;
  E.setScript('Ball', [ B.label('simulate'), inc('spin'), B.goto_('simulate') ]);
  bubble.textContent = '';
  const spun = E.runEvent(ctxOf('ball'), 'simulate', []);
  ok(spun === 'stopped', 'MUTANT: the loop TERMINATED - without a budget this hangs the suite');
  ok(/never finished thinking/.test(bubble.textContent),
     'Beep says so: "' + bubble.textContent + '"');
  ok(L.state.spin > 0 && L.state.spin < E.STEP_BUDGET,
     'it got some way round - ' + L.state.spin + ' laps of a ' + E.STEP_BUDGET + '-statement budget');
  ok(!E.idle(ctxOf('ball')), 'and it is left part-way through, pc parked, so the bug stays steppable');

  console.log('T14: a halt ENDS the tick - nothing after it runs');
  await freshWorld(sceneSimulate()); silence();
  L.state.order = -1;
  E.setScript('Brick',  [ B.label('simulate'), B.goto_('simulate') ]);   // bricks spin forever
  E.setScript('Paddle', [ B.label('simulate'), digit(3), B.ret() ]);
  E.tick();
  ok(L.state.order === 0,
     'MUTANT: the scene ran, brick1 spun out, and the paddle NEVER RAN - when Beep '
     + 'stops, everything stops, got ' + L.state.order);

  console.log('T15: setScript fills the class`s script IN PLACE, so live instances see it');
  await freshWorld(); silence();
  const scriptRef = E.scriptOf('Brick');
  E.setScript('Brick', [ B.label('simulate'), B.ret() ]);
  ok(E.scriptOf('Brick') === scriptRef,
     'MUTANT: the same array - a fresh one would leave live contexts on the old script');
  ok(ctxOf('brick1').script === scriptRef, 'and brick1`s context is running exactly it');
  ok(ctxOf('brick2').script === ctxOf('brick3').script,
     'three Bricks, one script - it belongs to the class');

  console.log('T16: the event names are the labels a learner writes');
  ok(E.EVENTS.simulate === 'simulate' && E.EVENTS.spawn === 'spawn'
     && E.EVENTS.despawn === 'despawn' && E.EVENTS.start === 'start',
     'simulate / spawn / despawn / start - ordinary label names, nothing reserved');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
