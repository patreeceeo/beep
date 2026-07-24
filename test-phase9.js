/* Phase 9 verification: statements as material - add / delete / duplicate /
   stash / dangling jumps / confused Beep / whole-list Reset. Same jsdom
   pattern as the Phase 8 suite. */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/beep-runs-your-code-v5.html', 'utf-8');
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

(async () => {
  await sleep(50);

  const paletteEl = document.getElementById('palette');
  const trayEl = document.getElementById('tray');
  const trashEl = document.getElementById('trash');
  const blocksBox = document.getElementById('blocksBox');
  setRect(trayEl, 600, 0, 200, 60);
  setRect(trashEl, 900, 0, 74, 60);

  const blockCount = () => blocksBox.querySelectorAll(':scope > .block:not(.placeholder)').length;
  const seedCount = blockCount();

  // materialized drag: down on source, move + up over the program (or a zone)
  async function dragStmt(srcEl, x, y) {
    srcEl.dispatchEvent(pev('pointerdown', 15, 515));
    blocksBox.dispatchEvent(pev('pointermove', x, y));
    blocksBox.dispatchEvent(pev('pointerup', x, y));
    await sleep(30);
  }
  // grip drag of an existing block
  async function dragBlock(el, x, y) {
    el.querySelector('.grip').dispatchEvent(pev('pointerdown', 50, 100));
    blocksBox.dispatchEvent(pev('pointermove', x, y));
    blocksBox.dispatchEvent(pev('pointerup', x, y));
    await sleep(30);
  }

  console.log('T1: statement shelf');
  const stmtProtos = paletteEl.querySelectorAll('.stmt-tile.proto');
  ok(stmtProtos.length === 7, '7 statement prototypes, got ' + stmtProtos.length);
  ok([...stmtProtos].some(t => /despawn/.test(t.textContent)), 'despawn is on the shelf (Phase 10)');
  ok([...stmtProtos].some(t => /paddleX/.test(t.textContent) && t.classList.contains('assign')),
     'identity assign on the shelf');

  console.log('T2: drag a statement in - it lands as a real block');
  const assignProto = [...stmtProtos].find(t => t.classList.contains('assign'));
  await dragStmt(assignProto, 100, 300);
  ok(blockCount() === seedCount + 1, 'program grew by one');
  const lastBlock = blocksBox.querySelectorAll(':scope > .block')[blockCount() - 1];
  ok(lastBlock.classList.contains('assign') && /paddleX/.test(lastBlock.textContent),
     'the new block is the identity assign');

  console.log('T3: a fresh jump binds to the nearest flag');
  const gotoProto = [...stmtProtos].find(t => t.classList.contains('jump'));
  await dragStmt(gotoProto, 100, 300);
  const newGoto = [...blocksBox.querySelectorAll(':scope > .block.jump')].pop();
  ok(newGoto.querySelector('.flagref') && !newGoto.querySelector('.flagref.lost'),
     'jump target bound (not frayed): ' + newGoto.textContent.trim());

  console.log('T4: grip tap opens the statement menu; duplicate works');
  const before4 = blockCount();
  const actionBlock = blocksBox.querySelector(':scope > .block.action');
  actionBlock.querySelector('.grip').dispatchEvent(pev('pointerdown', 50, 100));
  blocksBox.dispatchEvent(pev('pointerup', 50, 100));      // no move: a tap
  await sleep(30);
  const menu = document.querySelector('.leaf-pop');
  ok(menu !== null, 'menu opened');
  const dupBtn = menu && [...menu.querySelectorAll('.opt')].find(b => b.textContent === 'duplicate');
  dupBtn && dupBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  ok(blockCount() === before4 + 1, 'duplicate inserted');
  ok(actionBlock.nextElementSibling && actionBlock.nextElementSibling.classList.contains('action'),
     'clone sits right below the original');

  console.log('T5: drag a block to Trash deletes it (no dialog for non-labels)');
  const before5 = blockCount();
  await dragBlock(actionBlock.nextElementSibling, 930, 30);
  ok(document.querySelector('.collapse-modal') === null, 'no dialog for a command');
  ok(blockCount() === before5 - 1, 'block deleted');

  console.log('T6: deleting a referenced label warns, then the jumps dangle');
  const goRightLabel = [...blocksBox.querySelectorAll(':scope > .block.labelrow')]
    .find(el => /goRight/.test(el.textContent));
  const before6 = blockCount();
  await dragBlock(goRightLabel, 930, 30);
  const modal = document.querySelector('.collapse-modal');
  ok(modal !== null && /Remove this flag/.test(modal.textContent), 'confirm dialog appeared');
  ok(/point at .*nothing/.test(modal.textContent), 'dialog warns about dangling jumps');
  ok(blockCount() === before6, 'nothing removed yet');
  modal.querySelector('.cm-go').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(150);
  ok(document.getElementById('nemesis').classList.contains('here'), 'the nemesis appears');
  ok(blockCount() === before6, 'the flag still stands while its ropes are zapped');
  await sleep(2000);          // entrance + 1 rope zap + exit
  ok(blockCount() === before6 - 1, 'label removed after the show');
  ok(blocksBox.querySelector('.flagref.lost') !== null, 'its jumps now render frayed');
  ok(!document.getElementById('nemesis').classList.contains('here'), 'nemesis slinks away');

  console.log('T7: Beep hits the dangling jump and stops, confused');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
  document.getElementById('btnPlay').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(800);
  window.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'ArrowRight' }));
  const bubble = document.getElementById('bubble');
  ok(/where did it go/.test(bubble.textContent), 'confused bubble: ' + bubble.textContent);
  ok(document.getElementById('btnPlay').textContent.indexOf('Play fast') !== -1, 'play mode stopped itself');
  ok(document.getElementById('robot').classList.contains('confused'), 'Beep wears his confusion');

  console.log('T8: stash a statement on the shared spare tiles');
  const before8 = blockCount();
  const moveBallBlock = [...blocksBox.querySelectorAll(':scope > .block.action')]
    .find(el => /ball/.test(el.textContent));
  await dragBlock(moveBallBlock, 700, 30);
  ok(blockCount() === before8 - 1, 'block left the program');
  const stashed = trayEl.querySelector('.stmt-tile');
  ok(stashed !== null && /ball/.test(stashed.textContent), 'it rests in the tray as a mini block');
  ok(trayEl.querySelectorAll('[data-sl]').length >= 5, 'expression tiles share the same tray');

  console.log('T9: drag the stashed statement back into the program');
  await dragStmt(stashed, 100, 200);
  ok(blockCount() === before8, 'block returned to the program');
  ok(trayEl.querySelector('.stmt-tile') === null, 'tray tile gone');

  console.log('T10: Reset restores the whole seed program');
  document.getElementById('btnReset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  ok(blockCount() === seedCount, 'seed statement count restored (' + seedCount + ')');
  // scope to the program: shelf jump prototypes are frayed BY DESIGN (bind on drop)
  ok(blocksBox.querySelector('.flagref.lost') === null, 'no frayed references remain in the program');
  ok(trayEl.children.length === 5, 'tray back to its 5 seed tiles');
  ok(paletteEl.querySelectorAll('.stmt-tile.proto').length === 7, 'statement shelf untouched');

  console.log('T11: a purely SIDEWAYS drag reaches the zones (activation fix)');
  // re-stub the tray at the same height as the grip press, so the drag has
  // zero vertical movement - only the horizontal component can activate it
  setRect(trayEl, 600, 80, 200, 60);
  const before11 = blockCount();
  const cmdBlock = blocksBox.querySelector(':scope > .block.action');
  cmdBlock.querySelector('.grip').dispatchEvent(pev('pointerdown', 50, 100));
  blocksBox.dispatchEvent(pev('pointermove', 700, 100));   // dy = 0, dx = 650
  blocksBox.dispatchEvent(pev('pointerup', 700, 100));
  await sleep(30);
  ok(blockCount() === before11 - 1, 'sideways drag activated and stashed the block');
  ok(trayEl.querySelector('.stmt-tile') !== null, 'block landed in the spare tiles');
  ok(document.querySelector('.leaf-pop') === null, 'no grip menu misfire');

  console.log('T12: side panels fold and reorder');
  const side = document.querySelector('.side');
  const panels = [...side.querySelectorAll(':scope > .panel')];
  ok(panels.length >= 5 && panels.every(pn => pn.querySelector('.panel-head')), 'all panels grew heads');
  const sparePanel = panels.find(pn => /Spare tiles/i.test(pn.querySelector('h2').textContent));
  const head = sparePanel.querySelector('.panel-head');
  head.dispatchEvent(pev('pointerdown', 50, 400));
  document.dispatchEvent(pev('pointerup', 50, 400));       // a tap: fold
  await sleep(10);
  ok(sparePanel.classList.contains('collapsed'), 'tap folds the panel');
  head.dispatchEvent(pev('pointerdown', 50, 400));
  document.dispatchEvent(pev('pointerup', 50, 400));       // tap again: unfold
  await sleep(10);
  ok(!sparePanel.classList.contains('collapsed'), 'tap again unfolds');
  panels.forEach((pn, i) => setRect(pn, 500, i * 120, 300, 110));
  head.dispatchEvent(pev('pointerdown', 50, 400));
  document.dispatchEvent(pev('pointermove', 50, 5));       // above the first panel's midpoint
  document.dispatchEvent(pev('pointerup', 50, 5));
  await sleep(10);
  ok(side.querySelectorAll(':scope > .panel')[0] === sparePanel, 'dragged to the top of the column');
  ok(document.querySelector('.panel-placeholder') === null, 'placeholder cleaned up');
  const savedPanels = JSON.parse(window.localStorage.getItem('beepSidePanels'));
  ok(savedPanels && savedPanels.order[0] === 'spare-tiles', 'arrangement persisted');

  console.log('T12b: section notes live in help popovers');
  const helps = side.querySelectorAll('.panel-help');
  ok(helps.length === 3, '3 help discs (new pieces, spare tiles, run it), got ' + helps.length);
  ok(side.querySelector('.panel > .tray-note, .panel > .hint') === null, 'notes moved out of the panels');
  const disc = helps[0];
  disc.dispatchEvent(pev('pointerdown', 500, 20));
  await sleep(10);
  const shownPop = document.querySelector('.help-pop.show');
  ok(shownPop !== null && shownPop.textContent.length > 20, 'popover opens with the explanation');
  disc.dispatchEvent(pev('pointerdown', 500, 20));
  await sleep(10);
  ok(document.querySelector('.help-pop.show') === null, 'same disc toggles it closed');
  disc.dispatchEvent(pev('pointerdown', 500, 20));
  await sleep(10);
  document.body.dispatchEvent(pev('pointerdown', 10, 600));
  await sleep(10);
  ok(document.querySelector('.help-pop.show') === null, 'outside tap closes it');

  console.log('T13: chooser can send an operand to the spares (menu parity)');
  const ac13 = [...document.querySelectorAll('.block.assign .content')]
    .find(c => /ballX/.test(c.textContent) && /ballVelocityX/.test(c.textContent));
  ac13.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const opnd = [...ac13.querySelectorAll('.token.var')].find(t => t.textContent === 'ballVelocityX');
  opnd.dispatchEvent(pev('pointerdown', 100, 100));
  document.dispatchEvent(pev('pointerup', 100, 100));     // a tap: the chooser opens
  await sleep(10);
  const pop13 = document.querySelector('.leaf-pop');
  const toSpares = pop13 && [...pop13.querySelectorAll('.opt')].find(b => b.textContent === 'to spare tiles');
  ok(toSpares != null, 'chooser offers "to spare tiles"');
  const trayBefore13 = trayEl.children.length;
  toSpares.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  const cm13 = document.querySelector('.collapse-modal');
  ok(cm13 !== null, 'collapse dialog appeared (same rules as dropping)');
  cm13.querySelector('.cm-go').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  ok(trayEl.children.length === trayBefore13 + 1, 'operand became a spare tile');
  ok(!/\+/.test(ac13.textContent), 'bin collapsed to the survivor');

  console.log('T14: chooser can trash a spare tile');
  const varTile = [...trayEl.children].find(t => t.classList.contains('var'));
  const trayBefore14 = trayEl.children.length;
  varTile.dispatchEvent(pev('pointerdown', 100, 100));
  document.dispatchEvent(pev('pointerup', 100, 100));
  await sleep(10);
  const pop14 = document.querySelector('.leaf-pop');
  const trashOpt = pop14 && [...pop14.querySelectorAll('.opt')].find(b => b.textContent === 'trash this tile');
  ok(trashOpt != null, 'chooser offers "trash this tile"');
  trashOpt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(10);
  ok(trayEl.children.length === trayBefore14 - 1, 'tile gone');

  console.log('T15: chip taps author references (Phase 10)');
  const click = () => new window.MouseEvent('click', { bubbles: true });
  const gotoRow = [...blocksBox.querySelectorAll(':scope > .block.jump')]
    .find(el => /start/.test(el.textContent));
  gotoRow.querySelector('.flagref').dispatchEvent(click());
  await sleep(30);
  let pop15 = document.querySelector('.leaf-pop');
  ok(pop15 !== null && [...pop15.querySelectorAll('.opt')].length >= 8, 'retarget chooser lists the flags');
  [...pop15.querySelectorAll('.opt')].find(o => o.textContent === '\u2691 move').dispatchEvent(click());
  await sleep(30);
  ok(/\u2691 move/.test(gotoRow.textContent), 'goto retargeted to move');

  const moveLabel = [...blocksBox.querySelectorAll(':scope > .block.labelrow')]
    .find(el => /move/.test(el.textContent));
  moveLabel.querySelector('.flag').dispatchEvent(click());
  await sleep(30);
  pop15 = document.querySelector('.leaf-pop');
  const rn = pop15 && pop15.querySelector('input');
  ok(rn !== null && rn.value === 'move', 'rename editor opens with the current name');
  rn.value = 'groove';
  rn.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(30);
  ok(/groove/.test(moveLabel.textContent), 'flag renamed');
  ok(/\u2691 groove/.test(gotoRow.textContent), 'the jump followed the rename');
  ok(blocksBox.querySelector('.flagref.lost') === null, 'no reference broke');

  const before15 = blockCount();
  gotoRow.querySelector('.flagref').dispatchEvent(click());
  await sleep(30);
  pop15 = document.querySelector('.leaf-pop');
  [...pop15.querySelectorAll('.opt')].find(o => /new flag below/.test(o.textContent)).dispatchEvent(click());
  await sleep(30);
  ok(blockCount() === before15 + 1, '"+ new flag below" minted a label');
  const newFlagRow = gotoRow.nextElementSibling;
  ok(newFlagRow.classList.contains('labelrow'), 'it sits right under the jump');
  const newName = newFlagRow.querySelector('.flag').textContent.replace('\u2691', '').trim();
  ok(gotoRow.textContent.indexOf(newName) !== -1, 'and the jump points at it');

  console.log('T16: LHS + sprite chips repoint too');
  const assignRow = [...blocksBox.querySelectorAll(':scope > .block.assign')]
    .find(el => /ballY/.test(el.textContent));
  assignRow.querySelector('.tgt-chip').dispatchEvent(click());
  await sleep(30);
  pop15 = document.querySelector('.leaf-pop');
  [...pop15.querySelectorAll('.opt')].find(o => o.textContent === 'brick1X').dispatchEvent(click());
  await sleep(30);
  ok(assignRow.querySelector('.tgt-chip').textContent === 'brick1X', 'assign now writes into brick1X');

  const despawnRow = [...blocksBox.querySelectorAll(':scope > .block.action')]
    .find(el => /despawn/.test(el.textContent));
  despawnRow.querySelector('.sprite-chip').dispatchEvent(click());
  await sleep(30);
  pop15 = document.querySelector('.leaf-pop');
  ok([...pop15.querySelectorAll('.opt')].some(o => o.textContent === 'paddle')
     && [...pop15.querySelectorAll('.opt')].some(o => o.textContent === 'ball'),
     'sprite chooser offers paddle and ball, not just bricks');
  [...pop15.querySelectorAll('.opt')].find(o => o.textContent === 'paddle').dispatchEvent(click());
  await sleep(30);
  ok(despawnRow.querySelector('.sprite-chip').textContent === 'paddle', 'despawn now takes the paddle');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
