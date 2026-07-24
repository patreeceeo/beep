/* Grammar expansion verification (Phase 11a): x and div as number->number ops.
   Mostly unit tests through the window.__lang seam (evalExpr / opGlyph / OPS /
   FLIP / constructors), plus a DOM check that the palette auto-derived the two
   new op tiles. The always-valid invariant is unchanged: x/div are number->
   number like +/-, so in-place wrap still applies and no boolean slot is
   involved. Div-by-zero is guarded to 0 so sprite math never goes non-finite. */
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

(async () => {
  await sleep(50);
  const L = window.__lang;
  const { evalExpr, opGlyph, OPS, FLIP, bin, num, v } = L;
  const E = (op, a, b) => evalExpr(bin(op, num(a), num(b)));

  console.log('T1: OPS now carries x and div (number->number, identity 1)');
  ok(OPS.length === 4, 'four ops, got ' + OPS.length);
  const byOp = Object.fromEntries(OPS.map(o => [o.op, o]));
  ok(byOp['*'] && byOp['/'], 'x and div present');
  ['+','-','*','/'].forEach(op =>
    ok(byOp[op].in === 'number' && byOp[op].out === 'number', op + ' is number->number'));
  ok(byOp['*'].identity === 1 && byOp['/'].identity === 1, 'x and div seed identity 1');
  ok(byOp['+'].identity === 0 && byOp['-'].identity === 0, '+ and - keep identity 0');

  console.log('T2: opGlyph maps every op');
  ok(opGlyph('+') === '+', '+');
  ok(opGlyph('-') === '−', '- -> minus');
  ok(opGlyph('*') === '×', '* -> multiplication sign');
  ok(opGlyph('/') === '÷', '/ -> division sign');

  console.log('T3: evalExpr computes all four');
  ok(E('+', 2, 3) === 5, '2 + 3 = 5');
  ok(E('-', 7, 2) === 5, '7 - 2 = 5');
  ok(E('*', 6, 7) === 42, '6 x 7 = 42');
  ok(E('/', 20, 4) === 5, '20 / 4 = 5');
  ok(E('/', 7, 2) === 3.5, '7 / 2 = 3.5 (decimals survive)');

  console.log('T4: division by zero is an ERROR (flagged), not a silent 0');
  ok(L.divCheck(bin('/', num(5), num(0))).divByZero === true, '5 / 0 flags divByZero');
  ok(L.divCheck(bin('/', num(20), num(4))).divByZero === false, '20 / 4 does not flag');
  ok(L.divCheck(bin('/', num(20), num(4))).value === 5, '20 / 4 still computes 5');
  ok(Number.isFinite(L.divCheck(bin('/', num(1), num(0))).value), 'flagged result stays finite (no NaN/Infinity)');
  ok(L.dividesByZero(bin('/', num(3), num(0))), 'detector flags a /0 subtree');
  ok(!L.dividesByZero(bin('/', num(3), num(2))), 'detector clears a safe division');
  ok(L.dividesByZero(bin('+', num(1), bin('/', num(2), num(0)))), 'detector finds a nested /0');

  console.log('T5: wrapping in an identity is a behaviour no-op');
  ['*','/'].forEach(op =>
    ok(E(op, 9, byOp[op].identity) === 9, '9 ' + op + ' ' + byOp[op].identity + ' = 9'));
  ['+','-'].forEach(op =>
    ok(E(op, 9, byOp[op].identity) === 9, '9 ' + op + ' ' + byOp[op].identity + ' = 9'));

  console.log('T6: FLIP toggles same-type partners and is involutive');
  ok(FLIP['+'] === '-' && FLIP['-'] === '+', '+ <-> -');
  ok(FLIP['*'] === '/' && FLIP['/'] === '*', 'x <-> div');
  ['+','-','*','/'].forEach(op =>
    ok(FLIP[FLIP[op]] === op, op + ' flip is involutive'));

  console.log('T7: the palette auto-derived the two new op tiles');
  const optiles = [...document.getElementById('palette').querySelectorAll('.optile.proto')];
  ok(optiles.length === 4, 'four op tiles on the shelf, got ' + optiles.length);
  const glyphs = optiles.map(e => e.textContent);
  ok(glyphs.indexOf('×') !== -1 && glyphs.indexOf('÷') !== -1, 'shelf shows x and div');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
