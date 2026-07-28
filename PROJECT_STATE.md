# Beep — project state & handoff

Beep is a block-based pedagogical language. A robot ("Beep") runs a Breakout game
one AST node at a time, and the whole point is that the learner can directly
manipulate that AST through the UI. This note is a handoff so any fresh session can
resume without re-deriving context.

## Where the work lives
- **Active file:** `beep.html` (single self-contained HTML file).
- Every phase is documented inline with a comment block explaining its invariant.
- **Preview:** the in-app split view shows blank; test by opening the .html in a
  real browser (it needs real JS + keyboard/pointer input).

## Files in this folder
Persisted (source of truth): `beep.html`, this file,
`test-phase8.js`, `test-phase9.js`, `test-drop.js`, `test-grammar.js`,
`test-diverror.js`, `test-compare.js`, `test-bool.js`, `test-sprite.js`,
`package.json` (+ lockfile).
Generated - recreate, don't commit: `node_modules` (`npm install`),
`beep-extract.js` (script extraction for `node --check`), any `patch*.py`
(one-shot edit scripts, already applied).

## The guiding invariant (do not break)
**Always-valid program:** no empty slots, no dangling required fields, ever. New
*(Amended in Phase 9: STRUCTURE stays always-valid, but a jump's REFERENCE may
dangle after a confirmed label deletion — rendered frayed, wire hidden, and Beep
stops confused if he tries it. This is deliberate pedagogy, not a bug.)*
material arrives pre-filled with an identity default; any removal leaves a complete
substitute behind. Corollaries the whole codebase leans on:
- **One tree, three views:** display (`renderStmt`/`nodeHtml`), values (`bubbleExpr`),
  and behaviour (`evalExpr`/`execStmt`) all derive from the same node. Never
  special-case the visuals — mutate the node and let all three follow.
- **Direct manipulation** over modal forms; every edit is a gesture on the thing.
- **Reset = deep-clone snapshot.** `_initialExpr`/`_initialCond` (per statement) and
  `traySeed` are cloned at init; any new mutable field must be covered by them.
- **Type safety** via `typeOf` / `expectedType` / `compatible`; every create/place
  path routes through it.

## AST model (quick reference)
- Statements: `label`, `goto`, `ifjump`, `assign`, `command`.
- Phase-8 palette: `PALETTE` entries `{kind:'value', make}` | `{kind:'op', op}` |
  `{kind:'stmt', make}` (Phase 9).
- jsdom suites alongside the html: `test-phase8.js` (28 asserts) and
  `test-phase9.js` (63 asserts, incl. panel fold/reorder, help popovers, menu parity, nemesis, Phase-10 chip choosers). Both must stay green; phase-8's T1/T2
  count `.proto:not(.stmt-tile)` (**32** today: 1 num + 8 vars + 8 sensors +
  2 yes/no + 6 comparisons + 7 ops — bump them when the shelf grows), and
  post-Reset tests must RE-QUERY block elements (Reset rebuilds them all
  since Phase 9).
- Expressions: `num`, `var`, `bin{op,left,right}`. Booleans: `key`, `touch`,
  `bool{value}` (11c literal), `cmp{op,left,right}` (11b — boolean-typed but its
  OPERANDS are numbers), `not{operand}` (11c — the only UNARY node).
  A `bin` is BOTH: it takes its type from its op (`+` number, `and` boolean).
- Constructors: `v`, `num`, `bin`, `keyCond`, `touchCond`, `cmp`, `bool`, `notOf`;
  builders `label/goto_/…`.
- Eval/render: `evalExpr`, `execStmt`, `renderStmt` (compact), `nodeHtml` (editable/
  draggable), `htmlExpr` (compact expr), `bubbleExpr` (values substituted).
- **Slot registry:** `slotReg` maps id → `{parent, field}`; `reg` / `slotNode` /
  `setSlotNode` / `slotIdOf`. Rebuilt on every `renderSlots`. Every `bin` registers a
  `selfId` used by the operator's `data-op` AND (nested) the group's `data-sl`.

## Phases done (1–10)
1. Grip handles — drag whole statements to reorder.
2. AST evaluator — statements are data, not closures.
3. Swap-based editing — drag an operand; every drop SWAPS two nodes (no empty slots).
4. Subtree moves — drag whole `bin` groups, not just leaves.
5. Shape-typed conditions — boolean predicates as gold hexagons; type-checked slots.
6. In-place leaf editing — **tap** a piece → chooser popover:
   - number: decimals allowed, clamped only to JS safe-integer range (no rounding);
     steppers `tidy()` float noise.
   - variable: pick another backpack var. sensor: pick another key/touch predicate.
7. Grow + prune:
   - **Prune (collapse):** drag an operand to **Trash** (discard) or the **spare-tiles
     area** (keep it as a tile) → confirm dialog previews `bin → leftover operand`;
     the bin is replaced by the operand you did NOT drag. Required-slot operands
     refuse (would empty a slot).
   - **Grow (wrap):** pull-based, type-filtered. Tap a piece → its menu has a
     **"wrap in"** section listing only ops valid for its type. The **operator is the
     bin's handle** — tap it to flip the sign (folded-in toggle) or wrap the whole
     subtree. Wrap seeds the op's identity (`+`/`−` → 0) so behaviour is unchanged
     until the fresh operand (flashed) is tuned.

8. Palette (infinite typed source) + generalized sink:
   - **"New pieces" panel:** static prototype shelf (`#palette`, built once, Reset
     ignores it): num `0`, one tile per `VARS`, all 8 sensors, one tile per `OPS`.
   - **Drag = mint:** pointerdown clones a ghost + a fresh node (`item.make()`);
     the prototype never leaves. `pieceDrag.role='proto'`, `pieceDrag.proto=item`,
     pre-lifted (`moved:true`), resolved by `finishPaletteDrag` (early return in
     `onSlotUp`).
   - **Value drop REPLACES** (not swaps): displaced node retreats to the spare
     tiles - material is never lost. Tray open area mints a tile. **Op tile drop
     WRAPS** the target via `wrapNode` (works on tray tiles too - grow on the
     workbench). **Trash = cancel** for a fresh piece (it was never in the tree).
   - `dropAllowed(dragEl, targetEl)` is the one gate: proto-value -> target
     expectedType only (tray cells excluded); proto-op -> two-sided wrap filter;
     else falls through to `compatible` (swap rule). `canStash` gates tray-zone
     highlight. New op/variable => palette tile appears automatically.

9. Statements are material (add / delete / duplicate / stash / dangling jumps):
   - **Shelf group "statements":** all identity no-ops — `paddleX = paddleX`,
     jumps with `target:'?'` that **bind to the nearest flag below on drop**
     (`bindJumpTarget`), auto-named flags (`uniqueLabelName`), plus the two
     atomic commands. (despawn not on the shelf — needs param authoring.)
   - **Materialized drags:** a shelf/tray statement becomes a REAL block at
     once (`startMaterializedDrag`) and rides the ordinary reorder machinery
     (same placeholder gap, same `reorderProgramFromDom` commit). A mere tap
     `unmaterialize`s it. `buildBlock(b, beforeEl)` is the factored builder.
   - **Grip tap = statement menu** (`openStmtMenu`): duplicate / to spare
     tiles / delete. Duplicated labels auto-rename.
   - **ONE tray:** statements stash beside expression tiles as `.stmt-tile`
     (`data-st`, never in `slotReg` — the swap machinery cannot see them).
   - **The nemesis:** confirming deletion of a wired flag runs a show first
     (`nemesisZap`): Beep's rival (`#nemesis`, right edge, mirror of the robot)
     drops in at the flag, glides to each holder jump, zaps its rope
     (`rope-zap` crackle -> `rope-dead` fade), then leaves and only THEN does
     `removeStmt` run - the data change is identical, just postponed (~1.6s +
     0.84s per extra rope). `nemesisBusy` guards re-entry (falls back to plain
     removeStmt). Tests must wait ~2s after confirming (T6).
   - **INVARIANT AMENDED (deliberate):** structure stays always-valid, but
     REFERENCES may dangle. Deleting a referenced label → confirm dialog
     (`openLabelDialog`, holders' ropes highlighted); confirmed → jumps go
     frayed (`.flagref.lost`), their wires vanish (`drawWires` early-out), and
     at RUN time Beep stops and puzzles (`beepConfused`; `labelIndex` now
     returns −1, `nextPc` returns `'lost'`, pc STAYS on the broken jump). The
     broken program remains runnable — the bug is visible and steppable.
   - **Reset restores the whole LIST** from `programSeed` (cloneStmt), same
     philosophy as the tray seed. `mk()` no longer pre-renders (`node.html`
     removed — it was vestigial and raced `labelIndex`).

9b. Reachable zones (the sticky side column outgrows the viewport):
   - **Adjustable workbench** (a zone dock was built then REVERTED in favor of
     this): every side panel folds (tap its `.panel-head`) and reorders (drag
     the head; >=6px total movement distinguishes drag from tap, same idiom as
     the grip). Order + folded state persist in localStorage key
     `beepSidePanels` (`panelKey` = slug of the h2 text). Pure DOM moves -
     element identity survives, so zone rects / handlers are untouched. NOTE:
     a folded Spare-tiles panel means its zone rect is 0x0 - drops there
     simply miss (no crash); the chooser menus below are the fallback.
   - **Help popovers:** each panel's explanation paragraph (`.tray-note` /
     `.hint`) is MOVED at init into a `.help-pop` behind a ?-disc in the
     header (left of the 36px chevron). Toggle on disc tap; outside tap /
     scroll / resize closes; one open at a time (`toggleHelp`/`closeHelp`).
   - **Stage + transport are ONE panel (this session).** The old "Run it"
     panel is gone: `.controls` and its `.hint` are direct children of the
     Stage panel now, sitting under the stage like a video player's transport
     bar — the buttons drive the picture, so they live with it. **Four side
     panels** (Stage / backpack / new pieces / spare tiles); still 3 help discs
     (the hint rides along and becomes Stage's). A saved `beepSidePanels`
     order containing the dead `run-it` key needs no migration — `initPanels`
     only honours keys that still resolve to a panel. `test-phase9` T12's
     panel-count assert was 5, now 4.
   - **Video-player icons (this session):** Step / Play / Reset carry inline
     SVG transport glyphs (`▶|`, `▶`, `|◀`) + a text label, so the row reads as
     playback before a word is read. `faceBtn(btn, ico, label)` swaps the play
     button's whole face (icon + label + `aria-label`) between `ICO_PLAY` and
     `ICO_PAUSE`; the static markup ships the same play glyph so the two can't
     drift. **Watch mode was DROPPED** (button, `watchLoop`, and the `'watch'`
     branch of `mode` all deleted) — `mode` is `idle | play`. Step already
     covers "show me one block at a time"; if the auto-advance is ever wanted
     back it is ~6 lines driving `stepAnimated` on a timer.
   - **Menu parity** (`appendZoneSection` in every chooser): operands get
     "to spare tiles" / "trash" (through the collapse dialog), tray tiles get
     "trash this tile", required slots get nothing. Statements already had
     this via the grip menu. Zones are convenience, not necessity.

10. Chips are references; tapping one repoints it (delegated in CAPTURE phase
   on blocksBox so a chip tap never doubles as a focus toggle):
   - **flagref tap → retarget chooser** (works on compact rows - goto is not
     focusable). Lists all flags + "+ new flag below" (mints an auto-named
     label after the jump and points at it). Repairs dangling jumps. Fresh
     materialized jumps flash their flagref as a tap-me hint.
   - **flag tap → rename-as-refactor** (`renameLabel`): every jump in the
     program AND stashed in the tray follows; `validFlagName` enforces
     letters/digits, ≤12 chars, unique (live `.bad` styling, invalid commits
     quietly keep the old name). Names remain the identity - no id migration.
   - **assign LHS tap → variable chooser** (`tgt-chip`; flashes the backpack
     tile). Clamped assigns keep their clamp when retargeted (documented).
   - **despawn sprite tap → sprite chooser.** despawn generalized: field `n`
     (1-3) → `sprite` ('brick1..3','paddle','ball'); `spriteAlive` map replaces
     `bricksAlive`; dead ball = no touches at all, dead target = that touch is
     false; variables keep computing after their sprite dies (deliberate).
     `despawnSprite`/`respawnAll` (Reset). despawn is on the shelf (7 stmt
     protos now). Interactive chips get hover rings; condition/bubble chips
     stay inert.

## Gesture map (current)
- Grip drag → reorder statement. Body tap → focus/unfocus statement.
- Drag operand → swap (compatible slot) / collapse (Trash or spare-tiles open area) /
  snap home. Drag a spare tile → Trash removes it.
- Tap operand (num/var/pred) → chooser (edit value) + "wrap in" + "take out" sections.
- Tap operator → bin menu: flip sign + "wrap in" (wraps whole subtree).
- Tap a comparison's operator (or its hexagon) → pick the test / "the opposite".
- Drag an `and`/`or`/`not` op tile onto any boolean piece → wraps it (and/or seed
  their identity, so behaviour is unchanged until you tune the fresh yes/no).
  Tap a `not`'s handle → "remove the not". Drag a yes/no hexagon → a literal.
  Drag a comparison hexagon from the shelf onto a condition → it REPLACES the
  sensor there (which retreats to the spares). Its two operands are normal number
  slots — drop a variable on one, wrap it in +, tap to retype it.
- Tap a chip → repoint the reference: flagref = retarget, flag = rename,
  assign LHS = pick variable, despawn sprite = pick sprite, edge = pick edge.
- Drag a sprite PILL onto any sprite slot (inside isTouching / an edge test /
  `x of` / `is alive`). Tap a pill → pick another sprite. Tap "x of" → x or y.
- Drag palette prototype → ghost copy: drop on compatible slot (replace; old piece
  to spares) / tray area (mint tile) / a piece, if an op tile (wrap) / Trash (cancel).
- Drag statement prototype / stashed statement tile → real block under the pointer,
  reorder-style gap; drop places it (fresh jumps bind to nearest flag).
- Grip drag → reorder / Trash (delete; referenced labels confirm first) / tray (stash).
  Activation counts TOTAL movement (x+y) and the ghost follows both axes, so a
  sideways pull toward the right-panel zones works — it was vertical-only before.
- Grip tap → statement menu: duplicate / to spare tiles / delete.

## Phase 12 — the SPRITE type (three types now: number, boolean, sprite)
A sprite used to be a name STRING baked into a statement. It is a VALUE now:
`sprite{name}`, `typeOf` → `'sprite'`, coral PILL on the shelf (numbers are teal
boxes, booleans gold hexagons — silhouette tells you the type before you read it).
- **Two BRIDGES off it** (in ≠ out, so by the 11c rule neither can be a bin op nor
  arrive by wrap; each is its own node type delivered as a palette VALUE prototype
  into a slot of its OUTPUT type, exactly as `cmp` is):
  `prop{prop,sprite}` = `x/y of <sprite>` (sprite→number, "x of" is its handle) and
  `alive{sprite}` = `<sprite> is alive` (sprite→boolean). The second closes a real
  Phase-10 gap: you could `despawn` a brick but never TEST for it.
- **`touch{left,right}`** — `isTouching` is a relationship between two sprites now,
  not a sensor with a baked-in subject. **`closing{left,right}`** (`isClosingOn`)
  is its companion: overlap and approach are two separate questions. `touchCond` and `TOUCH_OPTS` are RETIRED;
  one tile replaces the six old touch sensors and covers pairs they never could.
- **`edge{sprite,edge}`** — `<sprite> isTouching ⟨left edge⟩`. The EDGE is a CHIP,
  not a fourth type: four constants, never computed, never stored, never the result
  of anything, so the Phase-10 chip idiom fits and a type would be overkill.
  `viewLeftEdge / viewRightEdge / viewTopEdge / viewBottomEdge`.
- **The seed program migrated onto both**, and its wall test now reads
  `ball isTouching left edge or ball isTouching right edge` — the finer split is
  only sayable because Phase 11c added `or`. Nice demonstration in the default view.

### TOUCHING IS PURE OVERLAP — the guard lives in the PROGRAM (Phase 12d)
`isTouching` answers exactly one question and answers it the way a learner would:
are these two in the same place? No velocity anywhere in it. Same for an edge
test — at or past the edge, nothing more.

The approach guard that stops the ball sticking is a SEPARATE predicate,
`closing{left,right}` = `<sprite> isClosingOn <sprite>`, and the **seed program
applies it explicitly**:

    if ball isTouching left edge  and ballVelocityX < 0  ... jump bounceX   (or right/>)
    if ball isTouching paddle     and ball isClosingOn paddle  jump bounceY
    if ball isTouching brick1                                  jump hit1

That is the point: the rule that keeps the ball alive is a readable, editable part
of the program rather than a hidden engine rule. The edge rows use a plain
comparison on the velocity variable — a piece the learner already has, pointing at
a number they can watch in the backpack. Bricks need no guard at all, because a hit
despawns the brick so it cannot fire twice. **Why a guard is needed:** with pure
overlap and no guard, a ball that overshoots an edge flips its velocity every pass
and oscillates in place forever (x=−12, vX=+12 → trapped).

**`isClosingOn` must be judged PER COLLISION AXIS.** It first used a plain dot
product of the centre-line against relative velocity (`dx*vx + dy*vy`). That is
wrong for overlapping boxes and shipped a real gameplay bug: two boxes that overlap
have a TINY gap on the axis they collided along and a large one on the other, so
the irrelevant axis dominates the sum — a ball falling onto the paddle while
drifting sideways scored negative and passed straight through it, and brick hits
looked "delayed" for the same reason. The fix picks the collision AXIS first (the
shallower penetration is the axis the two have only just crossed) and asks about
that axis alone. `test-sprite.js` T9/T9b/T9c are the regressions; T9b fails loudly
if the dot product comes back. NOTE this was found by PLAYING the game, not by the
suite — the sprite tests all had the ball moving straight down.

**Known limit — `spriteVel` is convention-bound.** It reads `state.ballVelocityX/Y`
by NAME for the ball and returns zero for everything else, so: the paddle genuinely
moves (`nudgePaddle`) but reads as stationary, and a learner who builds movement
without those variables (`ballX = ballX + 2`) gets `{0,0}` and `isClosingOn` falls
back to its "nothing is moving" branch. Now that the guard is a single explicit
predicate rather than baked into every collision, this limitation is at least
visible in one place. The fix if it ever matters: cache each sprite's position per
program pass and derive velocity from the delta — convention-free, works for any
sprite moved by any means.

### Gotcha found the hard way
Phase 10 already had an `openSpritePop` (the despawn chip chooser). Duplicate
function declarations are legal JS — the later one silently wins — so a new
same-named chooser hijacked the call with no syntax error and no test failure until
a DOM test drove it. The Phase-12 one is `openSpriteValuePop`. **`node --check`
cannot catch this class of bug; only a test that actually taps the thing can.**

## THE TYPE RULE FOR BINS (Phase 11c — read this before adding an operation)
**A `bin` may host an op iff `in === out`.** That single rule decides where every
new operation goes, and it is the always-valid invariant applied to `bin`:
collapsing a bin replaces it with one of its operands, so unless the op preserves
its type, collapse would leave something of the wrong type in the slot. Hence:
- `+ − × ÷` (number→number) and `and or` (boolean→boolean) are ordinary bin ops,
  live in `OPS`, and arrive by **in-place wrap** — the palette op-tile drag and the
  chooser's "wrap in" section both derive from `OPS`, so adding one is one entry.
- a **comparison** is number→boolean, so it can NEVER be a bin — its own node type
  (`cmp`), delivered as a palette VALUE prototype dropped into a boolean slot.
- **`not`** is boolean→boolean but UNARY, and has no identity, so it breaks the
  other two `bin` assumptions instead. Own node type, own one-entry `UNARY_OPS`
  registry, unioned into `opsFor`, and `wrapNode` branches on `o.unary`.
`typeOf(bin)` and `expectedType(bin operand)` both read the op registry via
`opSig`, which is what makes the same `bin` machinery serve both worlds.

## Boolean grammar (Phase 11c)
- `bool{value}` — the yes/no LITERAL, the boolean counterpart of `num`. It exists
  for its own sake (a constant to force a branch) but it was also the blocker on
  and/or: wrap seeds an op's identity as a NODE (`identityNode`), and the identity
  of `and` is yes, of `or` is no. There was nothing to seed them with before.
- `and`/`or` in `OPS` (identity `true`/`false`), paired in `FLIP`. Everything
  downstream auto-derived: op tiles, wrap menus, the drop gate.
- `not{operand}` — its handle offers **"remove the not"**, because wrapping in it
  CHANGES the answer (no identity), so an un-undoable wrap would be a one-way door.
  Removal is always safe: `not X` and `X` are both booleans.
- **and/or evaluate EAGERLY — no short-circuit, deliberately.** The thought bubble
  prints both operands' values, so a half-evaluated expression would show Beep
  reporting a value he never actually read.
- A boolean `bin` or a `not` renders as a `.group.boolgroup` (gold): the box is
  coloured by TYPE, so a glance says what a subtree yields wherever it sits.
- `test-bool.js` (84 asserts) covers all of it, incl. the in===out invariant, the
  identity-is-a-no-op promise, De Morgan as a consistency check, and the chooser
  path for `not`. Mutation-tested against 6 seeded bugs.

## Comparison registry (Phase 11b)
`CMPS = [{op}]` for `<`, `>`, `<=`, `>=`, `==`, `!=`; `cmpGlyph` maps the stored
spelling to the maths glyph (`≤ ≥ = ≠`); `CMP_FLIP` pairs each test with its
logical NEGATION (`<`↔`>=`, `>`↔`<=`, `=`↔`≠`), which is what the operator
tap-menu's "the opposite" button applies. Deliberately SEPARATE from `OPS`:
comparisons are not wrap material, because `opsFor`'s two-sided filter would only
ever offer `<` to a number whose slot also expects a boolean, and no such position
exists. Adding a test = one `CMPS` entry + one `CMP_FLIP` pair.

## Operation registry (built for scale)
`OPS = [{op, identity, in, out}]` (today: `+`,`−` (id 0) and `×`,`÷` (id 1), all
number→number). A `FLIP` map pairs same-type toggle partners (`+`↔`−`, `×`↔`÷`)
for the operator tap-menu's "make it ..." flip.
`opsFor(node)` filters by `in === typeOf(node)` AND `out === expectedType(slot)` — a
two-sided filter, so in-place wrap is restricted to type-preserving ops (keeps the
invariant; a boolean sensor correctly shows no wrap). Adding an op/type = one entry.

## Verification pattern
- Extract `<script>`, run `node --check`.
- jsdom harness: polyfill `setPointerCapture`/`releasePointerCapture` (no-op),
  `elementsFromPoint=()=>[]`, force `requestAnimationFrame=cb=>setTimeout(cb,0)`.
  Drive the REAL handlers via dispatched pointer/mouse events; assert structure.
- **Gotchas:** async tests must flush `setTimeout(0)` between actions (`suppressClick`
  resets on a 0ms timer). Distinct drop zones need stubbed non-zero `getBoundingClientRect`.
  The editable view renders nested bins as `.group` boxes (no parens/spaces); only the
  compact view (`htmlExpr`) adds `( )` and spaces — assert structure, not punctuation.
- **Edits applied via a bash Python patch script** (exact-match replace, assert count==1),
  because the file-tools sometimes can't overwrite the mounted file on Windows.
- **If `require('jsdom')` hangs** (the mounted `node_modules` can wedge over the
  Windows mount): `npm install jsdom` into a sandbox-local dir (e.g. `/tmp/env`),
  copy `beep.html` + `test-*.js` there and run from there. `node --check` and the
  Python patch scripts still work against the mounted copy — only the jsdom load
  needs the local install.

## Unified drop model (Stages 1 + 2 DONE; Stage 3 deferred by design)
**Status:** the valuable seam has landed. Stage 1 gave a closed set of `VERBS`
+ a `DROP_TABLE` (payload x target -> verb) with `verbFor`; Stage 2 gave the
single `accepts(payload, target)` gate + `payloadOf` + `ZONE_ACCEPT`, and both
drag systems now route highlight AND resolution through them. `test-drop.js`
(33 asserts) tests the table + gate exhaustively; phase-8 (27) + phase-9 (63)
stay green (123 total). Stage 3 (merging the two pointer loops into one
lifecycle) is intentionally NOT done: the doc's own call is that it buys
coupling over clarity unless Phase 11 demands it, and verbs + gate are where
the value was. Pick it up then, not before. The original motivation + design
is preserved below for whoever tackles Stage 3 or Phase 11.

Motivation: three parallel drag subsystems have accreted, each fusing payload,
targets, and resolution: `pieceDrag` (onSlotDown/Move/Up; swap/replace/wrap +
dropOnZone + finishPaletteDrag), the block drag (onPointerDown/Move/End on
blocksBox; reorder + zones + materialized variant), and `panelDrag` (chrome).
Tap-menus (chooser "take out", grip menu) mirror drop outcomes by hand. The
rules of the language are scattered; unify by separating three concerns:

1. **Payloads** (closed set): `piece` (node in tree), `proto-value`,
   `proto-op`, `stmt`, `stmt-proto`, `panel`. Each declares only its lift
   visual (socket / placeholder gap / ghost clone) - presentation, not logic.
2. **Target registry** (three kinds, each owning hit-test + highlight ONCE):
   - *slot* - expression position; hit via elementsFromPoint + data-sl
   - *gap*  - position in an ordered list (program rows, panel column); hit
     via the midpoint-Y scan currently duplicated in two places
   - *zone* - tray / trash; hit via rects (overZone)
   `dropAllowed` generalizes to a single `accepts(payload, target)` gate -
   THE home of the always-valid invariant (typeOf/expectedType/dragRole all
   feed it).
3. **Verbs** (closed set of resolutions): `swap`, `replace`, `wrap`, `insert`,
   `stash`, `discard`, `collapse`, `remove`. Every (payload x target) pair
   maps to exactly one verb; the table IS the drop model - print it in a
   comment, test it exhaustively. Dialogs are verb middleware (collapse and
   remove-of-a-wired-label confirm first; the nemesis is post-confirm theater
   on `remove`). Menus stop mirroring: chooser + grip menu invoke verbs
   directly.

Why verbs are the valuable seam:
- **Undo stack** = log of executed verbs + inverses (swap self-inverse;
  replace remembers the displaced node; remove remembers stmt + index). Cheap:
  everything is already plain data.
- **JSON export/import** serializes the same tree the verbs mutate.
- **Phase-11 grammar** (comparisons need a "build INTO a boolean slot" flow)
  = new table rows, not a fourth subsystem. Wire-endpoint dragging = new
  target kind (`flag-anchor`) resolving to the existing retarget.

Staged migration (protect the 90 green asserts - NO big-bang):
- **Stage 1 - DONE (this session):** the closed set of verbs now lives in a
  `VERBS` object + a `DROP_TABLE` (payload x target -> verb) with a `verbFor`
  lookup and a `window.__drop` testing seam, in a commented "UNIFIED DROP
  MODEL - Stage 1" block after `refreshAllStmts`.
  `swap`/`replace`/`wrap`/`collapse`/`stashTile`/`discardTile`/`insert`/`remove`
  were factored out of swapSlots, finishPaletteDrag, dropOnZone, the
  collapse-dialog commit, and removeStmt/reorderProgramFromDom; every handler +
  `appendZoneSection` now routes through them. Behaviour byte-for-byte
  identical; phase-8 (27) + phase-9 (63) stay green and the new `test-drop.js`
  (20 asserts) proves the table is total, exhaustive, and realises exactly the
  8 closed verbs.
- **Stage 2 - DONE (this session):** zone acceptance + highlight now flow
  through one `accepts(payload, target)` gate (in the unified drop block).
  `accepts` type/cycle-checks slot targets (delegating to `dropAllowed`) and
  reads a payload-only `ZONE_ACCEPT` map for zone/gap targets; `payloadOf`
  turns a live drag descriptor (pieceDrag or a block drag) into a payload
  string. Both drag systems (markTargets, onSlotMove, onSlotUp,
  finishPaletteDrag; onPointerMove, onPointerEnd) call it for BOTH highlight
  and resolution, so the scattered `role !== 'fixed'` / `canStash` / bare
  `overZone` checks are gone (`canStash` deleted). Highlight follows `accepts`;
  the verb still comes from DROP_TABLE, so a zone can accept a drop yet fire no
  verb (a fresh palette piece over Trash is a consumed no-op cancel). Behaviour
  identical; `test-drop.js` grew to 33 asserts (T8-T12 cover the gate) and
  phase-8/9 stay green.
- **Stage 3 (optional):** merge the pointer loops into one lifecycle
  (lift -> track -> hit-test -> highlight -> resolve -> cleanup). Pieces and
  statements genuinely differ in hit-testing; `panelDrag` is chrome, not
  language material - forcing it in buys coupling, not clarity. Only do this
  if Phase 11 demands it; verbs + gate are where the value is.
- Verification per stage: all suites green (`node test-phase8.js`,
  `node test-phase9.js`, `node test-drop.js`); the last is the exhaustive
  payload x target verb-map + acceptance-gate table test (33 asserts).

## Open threads / next
- ~~"Fill a slot with a variable"~~ solved by Phase 8: drag the variable's palette
  tile onto the number (the displaced number goes to the spares).
- ~~Assign-target authoring~~, ~~despawn on the shelf~~, ~~label/jump
  authoring~~ — all landed in Phase 10 via the chip-tap rule.
- **Wire-endpoint dragging** (grab an arrowhead, drop it on another flag):
  lovely direct-manipulation polish, deferred (thin bezier hit targets).
- **Auto-open** the fresh operand's editor after wrap? Currently flash-only.
- **Wrap the ROOT expression by drop:** the root RHS has no `data-sl` wrapper
  (isRoot), so an op tile can't target the whole root bin - only its operands.
  The operator tap-menu covers it; a drop path would need a root target element.
- **Phase 9:** add/delete/duplicate whole statements. **Phase 10:** label + jump
  authoring (consider migrating jump targets from names to stable ids).
- **Consolidation:** ~~unified drop model~~ (Stages 1+2 landed - verbs + accepts gate;
  Stage 3 lifecycle-merge deferred), an undo stack (cheap given the clone snapshots),
  JSON export/import (the AST is already plain data).
- **Grammar expansion (orthogonal to editing UI):**
  - ~~`×`/`÷`~~ **DONE (Phase 11a, this session):** two number→number `OPS`
    entries (identity 1) + `opGlyph`/`evalExpr` cases + `FLIP`; palette tiles and
    wrap menus auto-derived from `OPS`, so no UI wiring was needed.
    `test-grammar.js` (36 asserts) covers it; a `window.__lang` seam unit-tests
    evaluation. phase-8's op-tile counts were bumped 2→4.
  - ~~`÷` by zero~~ **DONE (this session): divide-by-zero is an ERROR, not a
    silent 0.** `evalExpr` sets a `divByZero` flag (still returns 0 so sprite
    math stays finite until the caller halts); `execAssign` refuses the write
    and returns `{divZero}`. Two surfaces: **(authoring)** after every edit
    `checkDivZeroEdit` (in `renderSlots`) scans program+tray for a `/` whose
    divisor currently evaluates to 0 — a NEW one summons the **nemesis as a
    warning** (`nemesisWarn` + `.warn` shake; transition-tracked via
    `knownDivZero` so it fires once per creation). **(runtime)** when Beep
    reaches a live `/0` he stops **confused** (`beepConfusedDivide`, mirrors the
    lost-jump `beepConfused`); `stepInstant`/`finishPhase`/`fastForward` bail
    before `nextPc`, so pc parks on the broken row. `test-diverror.js` (15
    asserts) proves both surfaces end-to-end (real gestures + `stepInstant`).
  - ~~comparisons~~ **DONE (Phase 11b, this session): the "build INTO a boolean
    slot" flow, solved with machinery that already existed.** A comparison is its
    OWN node type `cmp{op,left,right}` — not a `bin` with a boolean-out op — so
    `bin` stays purely number→number and nothing can collapse a comparison down to
    a bare number sitting in a boolean slot. `typeOf(cmp)='boolean'` while
    `expectedType` of its `left`/`right` is `'number'`: that one asymmetry is the
    whole number→boolean bridge.
    - **How it reaches the tree:** as a palette **value prototype** (6 hexagons in
      a new `comparisons` shelf group, both operands seeded `0` — a comparison has
      no identity, so the honest default is a visibly blank test). Because it
      types as boolean, `dropAllowed` offers it on condition slots and NOWHERE
      else, and the drop fires the ordinary `replace` verb — the displaced sensor
      retreats to the spares. **No new payload, no new target, no new DROP_TABLE
      row** — Stage 1+2 of the unified drop model paid for themselves here exactly
      as predicted.
    - **Inside the hexagon are REAL slots:** its operands are ordinary number
      material, so drag/swap, tap-to-edit, and "wrap in +" all work in there for
      free. They are required slots, so `dragRole` already returns `'fixed'` and
      the zones already refuse them — collapse is impossible with zero new code.
    - **Operator = the handle** (same `selfId` idiom as `bin`): tap it (or the
      hexagon) for `openCmpPop` — "the opposite: ≥" first, then the six tests.
      Content-only edit, so the invariant holds by construction.
    - **Div-by-zero follows it in:** `collectDivZero`/`subtreeHas` now walk `cmp`,
      and `execStmt`'s ifjump returns `{divZero:true}` rather than deciding on a
      poisoned comparison — Beep halts on the row exactly as he does for an assign.
    - `test-compare.js` (80 asserts) covers evaluation, the flip-is-negation
      property, the shelf, a live drop into a condition, operand editing, the
      operator chooser, the REFUSAL of a comparison in a number slot, runtime, and
      Reset. Mutation-tested against 4 seeded bugs.
  - ~~and/or/not~~ **DONE (Phase 11c, this session)** — see "Boolean grammar"
    above. The mirror image of 11b: because and/or are boolean→BOOLEAN they are
    legal bin ops and came in through the **wrap** door that already existed,
    where comparisons could not. The only genuinely new machinery was the boolean
    LITERAL (wrap needs an identity to seed) and the unary branch for `not`.
    `appendWrapSection` on a `cmp` — wired but silently empty since 11b — now
    renders, exactly as predicted.
  - ~~a sprite/point TYPE~~ **DONE (Phase 12, this session)** — see the Sprite
    section above. The registries took it without a fight: `typeOf`/`expectedType`
    grew one branch each, and both bridges reused the `cmp` delivery route wholesale.
  - **Still open in Phase 12:** `despawn`'s sprite and the `movePaddle`/`moveBall`
    commands still bake a sprite NAME (despawn keeps its Phase-10 chip chooser).
    Converting them to real sprite SLOTS — and collapsing the two move commands into
    one `moveTo <sprite>` — is the obvious finish, and `moveTo(sprite)` is already
    written to take a name. Nothing depends on it; the type is complete without it.
