/* Unified drop model — Stage 1 verification: the exhaustive (payload x target)
   -> verb table. This suite doesn't drive the DOM; it reads the model directly
   through the window.__drop testing seam and asserts the map is total, that
   verbFor agrees with the table, that every non-null cell names a verb from the
   closed set, and that all eight verbs are reachable + implemented. The
   behavioural proof that handlers actually route through these verbs lives in
   the phase-8 and phase-9 suites (both stay green). */
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

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
