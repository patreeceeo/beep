/* Phase 8 verification: palette (infinite typed source) + generalized sink.
   Pattern per project handoff: jsdom, polyfilled pointer capture, stubbed
   elementsFromPoint (window.__stack), real handlers driven by dispatched
   pointer/mouse events, stubbed non-zero rects for distinct drop zones. */
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
// full palette drag: down on the prototype, move, up at (x,y) with a stubbed hit stack
async function dragProto(protoEl, x, y, stack) {
  setRect(protoEl, 10, 510, 40, 24);
  protoEl.dispatchEvent(pev('pointerdown', 15, 515));
  window.__stack = stack || [];
  document.dispatchEvent(pev('pointermove', x, y));
  document.dispatchEvent(pev('pointerup', x, y));
  window.__stack = [];
  await sleep(30);         // flush suppressClick (0ms) and render timers
}
const strip = el => el.textContent.replace(/\s+/g, '');

(async () => {
  await sleep(50);         // let init settle

  const paletteEl = document.getElementById('palette');
  const trayEl = document.getElementById('tray');
  const trashEl = document.getElementById('trash');
  // zones need distinct non-zero rects so overZone can tell them apart
  setRect(trayEl, 600, 0, 200, 60);
  setRect(trashEl, 900, 0, 74, 60);

  console.log('T1: palette structure');
  // Phase 9 added statement prototypes; the PIECE shelf is still 19
  const protos = paletteEl.querySelectorAll('.proto:not(.stmt-tile)');
  ok(protos.length === 19, '19 piece prototypes (1 num + 8 vars + 8 sensors + 2 ops), got ' + protos.length);
  ok(paletteEl.querySelectorAll('.pred.proto').length === 8, '8 sensor hexagons');
  ok(paletteEl.querySelectorAll('.optile.proto').length === 2, '2 operation tiles');
  ok(trayEl.children.length === 5, 'tray starts with 5 seed tiles');

  // focus  ballX = ballX + ballVelocityX
  const assignContent = [...document.querySelectorAll('.block.assign .content')]
    .find(c => /ballX/.test(c.textContent) && /ballVelocityX/.test(c.textContent));
  assignContent.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok(assignContent.querySelectorAll('[data-sl]').length >= 2, 'focused statement exposes slots');

  console.log('T2: value prototype REPLACES occupant; occupant retreats to spares');
  const numProto = paletteEl.querySelector('.token.num.proto');
  let target = [...assignContent.querySelectorAll('.token.var')].find(t => t.textContent === 'ballVelocityX');
  await dragProto(numProto, 100, 100, [target]);
  ok(assignContent.querySelector('.token.num') && assignContent.querySelector('.token.num').textContent === '0',
     'slot now holds the fresh 0');
  ok(trayEl.children.length === 6, 'tray grew to 6 tiles');
  ok(/ballVelocityX/.test(trayEl.textContent), 'displaced ballVelocityX is now a spare tile');
  ok(paletteEl.querySelectorAll('.proto:not(.stmt-tile)').length === 19, 'prototype stayed on the shelf');

  console.log('T3: operation prototype WRAPS its target (identity seeded)');
  const plusProto = [...paletteEl.querySelectorAll('.optile.proto')][0];
  target = assignContent.querySelector('.token.num');
  await dragProto(plusProto, 100, 100, [target]);
  ok(assignContent.querySelector('.group') !== null, 'a nested group appeared');
  ok(/0\+0/.test(strip(assignContent)), 'wrapped as 0 + 0 (identity: behaviour unchanged)');

  console.log('T4: type filter refuses a sensor on a number slot');
  const predProto = paletteEl.querySelector('.pred.proto');
  const before = strip(assignContent);
  target = [...assignContent.querySelectorAll('.token.var')].find(t => t.textContent === 'ballX');
  await dragProto(predProto, 100, 100, [target]);
  await sleep(220);        // ghost fade-out timer
  ok(strip(assignContent) === before, 'statement unchanged');
  ok(trayEl.children.length === 6, 'tray unchanged');
  ok(document.querySelector('body > .lifting') === null, 'ghost evaporated');

  console.log('T5: trash = cancel for a fresh piece');
  await dragProto(numProto, 930, 30, []);   // inside trash rect, no slot target
  ok(strip(assignContent) === before, 'statement unchanged');
  ok(trayEl.children.length === 6, 'tray unchanged');
  ok(document.querySelector('body > .lifting') === null, 'ghost evaporated');

  console.log('T6: tray open area mints a spare tile');
  const varProto = [...paletteEl.querySelectorAll('.token.var.proto')].find(t => t.textContent === 'paddleX');
  await dragProto(varProto, 700, 30, []);   // inside tray rect, no slot target
  ok(trayEl.children.length === 7, 'tray grew to 7');
  ok([...trayEl.children].some(t => t.textContent === 'paddleX'), 'minted paddleX tile');

  console.log('T7: sensor prototype replaces a condition (boolean slot)');
  const checkContent = [...document.querySelectorAll('.block.check .content')]
    .find(c => /isKeyPressed/.test(c.textContent));
  checkContent.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const touchProto = [...paletteEl.querySelectorAll('.pred.proto')].find(t => /brick1/.test(t.textContent));
  target = checkContent.querySelector('.pred[data-sl]');
  await dragProto(touchProto, 100, 100, [target]);
  ok(/isTouching/.test(checkContent.textContent) && /brick1/.test(checkContent.textContent),
     'condition is now touch brick1');
  ok(trayEl.children.length === 8 && /isKeyPressed/.test(trayEl.textContent),
     'displaced key sensor retreated to the spares');

  console.log('T8: Reset restores the tray; palette untouched');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  ok(trayEl.children.length === 5, 'tray back to 5 seed tiles');
  ok(paletteEl.querySelectorAll('.proto').length >= 19, 'palette still has all its prototypes');
  // Phase 9: Reset rebuilds every block element, so re-query rather than
  // trusting captured references
  const checkContent2 = [...document.querySelectorAll('.block.check .content')]
    .find(c => /isKeyPressed/.test(c.textContent));
  ok(checkContent2 !== undefined, 'condition restored');

  console.log('T9: regression - ordinary swap drag still works');
  const assignContent2 = [...document.querySelectorAll('.block.assign .content')]
    .find(c => /ballX/.test(c.textContent) && /ballVelocityX/.test(c.textContent));
  assignContent2.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const left = [...assignContent2.querySelectorAll('.token.var')].find(t => t.textContent === 'ballX');
  const right = [...assignContent2.querySelectorAll('.token.var')].find(t => t.textContent === 'ballVelocityX');
  setRect(left, 100, 100, 50, 24);
  left.dispatchEvent(pev('pointerdown', 110, 110));
  window.__stack = [right];
  document.dispatchEvent(pev('pointermove', 200, 110));   // >5px: a real drag
  document.dispatchEvent(pev('pointerup', 200, 110));
  window.__stack = [];
  await sleep(30);
  ok(/ballVelocityX\+ballX/.test(strip(assignContent2).replace(/^ballX=/, '')), 'operands swapped');

  console.log('T10: op prototype grows a spare tile on the workbench');
  const trayNum = [...trayEl.children].find(t => t.classList.contains('num'));
  const trayCount = trayEl.children.length;
  await dragProto([...paletteEl.querySelectorAll('.optile.proto')][0], 100, 100, [trayNum]);
  ok(trayEl.querySelector('.group') !== null, 'tray tile wrapped into a group');
  ok(trayEl.children.length === trayCount, 'tray count unchanged (grown in place)');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
