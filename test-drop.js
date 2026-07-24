/* Unified drop model — Stage 1 + 2 verification. This suite doesn't drive the
   DOM; it reads the model directly through the window.__drop testing seam.
   Stage 1 (T1-T7): the exhaustive (payload x target) -> verb table is total,
   verbFor agrees with it, every non-null cell names a verb from the closed set,
   and all eight verbs are reachable + implemented. Stage 2 (T8-T12): the single
   accepts(payload, target) gate matches an independent zone-acceptance table,
   gap acceptance is statements-only, the verb->accepts invariant holds, and
   payloadOf maps drag descriptors correctly. The behavioural proof that the
   handlers route through the verbs + gate lives in the phase-8 and phase-9
   suites (both stay green). */
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

const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ok - ' + name); }
  else { failed++; console.log('  FAIL - ' + name); }
}

// the canonical expectation, written out by hand so the test is an independent
// second source of truth (not just a copy of the shipped object)
const EXPECT = {
  'piece-operand': { slot:'swap',    gap:null,     'zone-trash':'collapse', 'zone-tray':'collapse' },
  'piece-tile':    { slot:'swap',    gap:null,     'zone-trash':'discard',  'zone-tray':null       },
  'piece-fixed':   { slot:'swap',    gap:null,     'zone-trash':null,       'zone-tray':null       },
  'proto-value':   { slot:'replace', gap:null,     'zone-trash':null,       'zone-tray':'stash'    },
  'proto-op':      { slot:'wrap',    gap:null,     'zone-trash':null,       'zone-tray':null       },
  'stmt':          { slot:null,      gap:'insert', 'zone-trash':'remove',   'zone-tray':'stash'    },
  'stmt-proto':    { slot:null,      gap:'insert', 'zone-trash':null,       'zone-tray':null       }
};
const CLOSED_VERBS = ['swap','replace','wrap','insert','stash','discard','collapse','remove'];

(async () => {
  await sleep(50);
  const drop = window.__drop;

  console.log('T1: the model is exposed');
  ok(drop && drop.DROP_TABLE && typeof drop.verbFor === 'function', 'window.__drop seam is present');
  ok(Array.isArray(drop.PAYLOADS) && drop.PAYLOADS.length === 7, '7 payloads declared');
  ok(Array.isArray(drop.TARGETS) && drop.TARGETS.length === 4, '4 targets declared');

  console.log('T2: table is total over payload x target');
  let total = true, cells = 0;
  drop.PAYLOADS.forEach(p => {
    const row = drop.DROP_TABLE[p];
    if (!row){ total = false; return; }
    drop.TARGETS.forEach(t => { if (!(t in row)) total = false; else cells++; });
  });
  ok(total, 'every payload x target cell is defined');
  ok(cells === 28, 'all 28 cells present, got ' + cells);

  console.log('T3: table matches the independent expectation');
  let mism = 0;
  drop.PAYLOADS.forEach(p => drop.TARGETS.forEach(t => {
    if (drop.DROP_TABLE[p][t] !== EXPECT[p][t]) {
      mism++; console.log('    mismatch ' + p + ' x ' + t + ': got ' + drop.DROP_TABLE[p][t] + ' want ' + EXPECT[p][t]);
    }
  }));
  ok(mism === 0, 'all 28 cells match expected verbs');

  console.log('T4: verbFor agrees with the table (incl. unknown -> null)');
  let vfOk = true;
  drop.PAYLOADS.forEach(p => drop.TARGETS.forEach(t => {
    if (drop.verbFor(p, t) !== drop.DROP_TABLE[p][t]) vfOk = false;
  }));
  ok(vfOk, 'verbFor(p,t) === DROP_TABLE[p][t] for all cells');
  ok(drop.verbFor('nonsense', 'slot') === null, 'unknown payload -> null');
  ok(drop.verbFor('piece-operand', 'nonsense') === null, 'unknown target -> null');

  console.log('T5: every named verb is in the closed set');
  const used = new Set();
  drop.PAYLOADS.forEach(p => drop.TARGETS.forEach(t => {
    const v = drop.DROP_TABLE[p][t]; if (v) used.add(v);
  }));
  let allKnown = true;
  used.forEach(v => { if (CLOSED_VERBS.indexOf(v) === -1) allKnown = false; });
  ok(allKnown, 'no cell names a verb outside the closed set');

  console.log('T6: the closed set is exactly realised');
  const missing = CLOSED_VERBS.filter(v => !used.has(v));
  ok(missing.length === 0, 'all 8 verbs are reachable in the table' + (missing.length ? ' (missing ' + missing.join(',') + ')' : ''));
  ok(used.size === 8, 'exactly 8 distinct verbs used, got ' + used.size);

  console.log('T7: executors exist for the resolutions');
  const V = drop.VERBS;
  ['swap','replace','wrap','collapse','stashTile','discardTile','insert','remove']
    .forEach(fn => ok(typeof V[fn] === 'function', 'VERBS.' + fn + ' is a function'));

  console.log('T8: Stage 2 acceptance gate is exposed');
  ok(typeof drop.accepts === 'function' && typeof drop.payloadOf === 'function', 'accepts + payloadOf present');
  ok(drop.ZONE_ACCEPT && drop.ZONE_ACCEPT['zone-trash'] && drop.ZONE_ACCEPT['zone-tray'], 'ZONE_ACCEPT map present');

  // independent second source of truth for zone acceptance (highlight/engage)
  const ZONE_EXPECT = {
    'zone-trash': { 'piece-operand':true, 'piece-tile':true,  'piece-fixed':false, 'proto-value':true, 'proto-op':true,  'stmt':true, 'stmt-proto':false },
    'zone-tray':  { 'piece-operand':true, 'piece-tile':false, 'piece-fixed':false, 'proto-value':true, 'proto-op':false, 'stmt':true, 'stmt-proto':false }
  };

  console.log('T9: accepts() matches the zone expectation, exhaustively');
  let zmis = 0;
  ['zone-trash','zone-tray'].forEach(z => drop.PAYLOADS.forEach(pl => {
    if (drop.accepts(pl, { kind:z }) !== ZONE_EXPECT[z][pl]) {
      zmis++; console.log('    mismatch ' + pl + ' x ' + z + ': got ' + drop.accepts(pl, {kind:z}) + ' want ' + ZONE_EXPECT[z][pl]);
    }
  }));
  ok(zmis === 0, 'all 14 payload x zone acceptances match');

  console.log('T10: gap acceptance is statements-only; unknown targets refused');
  ok(drop.accepts('stmt', { kind:'gap' }) && drop.accepts('stmt-proto', { kind:'gap' }), 'statements accept a gap');
  ok(!drop.accepts('piece-operand', { kind:'gap' }) && !drop.accepts('proto-value', { kind:'gap' }), 'expression pieces do not accept a gap');
  ok(drop.accepts('stmt', null) === false, 'a null target is refused');

  console.log('T11: verb -> accepts invariant (a firing verb implies acceptance)');
  let inv = true;
  drop.PAYLOADS.forEach(pl => {
    ['zone-trash','zone-tray'].forEach(z => {
      if (drop.verbFor(pl, z) && !drop.accepts(pl, { kind:z })) { inv = false; console.log('    violated ' + pl + ' x ' + z); }
    });
    if (drop.verbFor(pl, 'gap') && !drop.accepts(pl, { kind:'gap' })) { inv = false; console.log('    violated ' + pl + ' x gap'); }
  });
  ok(inv, 'every non-null zone/gap verb has accepts()=true');

  console.log('T12: payloadOf maps drag descriptors to payload strings');
  ok(drop.payloadOf({ role:'proto', proto:{ kind:'value' } }) === 'proto-value', 'proto value');
  ok(drop.payloadOf({ role:'proto', proto:{ kind:'op' } }) === 'proto-op', 'proto op');
  ok(drop.payloadOf({ role:'operand' }) === 'piece-operand', 'operand');
  ok(drop.payloadOf({ role:'tile' }) === 'piece-tile', 'tile');
  ok(drop.payloadOf({ role:'fixed' }) === 'piece-fixed', 'fixed');
  ok(drop.payloadOf({ block:{} }) === 'stmt', 'a block drag -> stmt');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
