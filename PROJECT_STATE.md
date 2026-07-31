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
`test-call.js`,
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
- Statements: `label`, `goto`, `ifjump`, `assign`, `command`, Phase 13's
  `visit`, `ifvisit`, `return`, `pack`, `unpack`, and Phase 14's `note`
  (`new note n`). The control-flow grid is (one-way | comes-back) x
  (always | if) and all four cells are filled.
- Phase-8 palette: `PALETTE` entries `{kind:'value', make}` | `{kind:'op', op}` |
  `{kind:'stmt', make}` (Phase 9).
- Nine jsdom suites, 569 asserts total; `test-call.js` (128) covers Phases 13, 13b and 14;
  `test-sprite.js` (94) covers Phases 12 and 15–17.
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
- Tap a chip → repoint the reference: flagref = retarget (a VISIT's too),
  flag = rename, assign/unpack LHS = pick variable, despawn sprite = pick
  sprite, edge = pick edge.
- Phase 13: drag in `visit ⚑x` (goes and remembers), `return` (comes back),
  `pack ⟨expr⟩` (parcel onto the back of the belt), `unpack into ⟨var⟩` (front
  parcel off it). A visit's rope is dashed; return has none, because where it
  goes is data. Bookmark tokens in the right gutter are the live call stack.
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

## Phase 13 — visits (calls), the bookmark stack, the parcel belt — DONE
A flag was a PLACE. It is a TOOL now: `visit ⚑x` goes there and remembers the
way back, `return` takes it, and a global FIFO belt carries values in both
directions. Built exactly to the spec agreed beforehand; the decisions and the
roads not taken are kept below because they are the interesting part.

**Vocabulary** (CS name in parens): `visit ⚑` (call) · `return` · the bookmark
pile (call stack) · `pack ⟨expr⟩` / `unpack into ⟨var⟩` (enqueue/dequeue) ·
the belt (FIFO queue). One belt serves BOTH directions — arguments packed
before the visit, results packed before the return. **A call is a protocol the
learner assembles (pack · visit · unpack), not an atomic thing the language
does for them.**

### The four statements
- **`visit{target}`** — sets `jumpTo`, and that ONE line is why it inherited
  everything: wires, the holder scan, rename-as-refactor, `bindJumpTarget`,
  the retarget chooser, the frayed-dangle rendering, the nemesis. Its rope is
  dashed (`path.call`) — a trip you come back from.
- **`return{}`** — **chipless and wireless on purpose.** Where it goes is DATA
  (the top bookmark), not syntax, so there is nothing static to draw and that
  absence is the lesson. Kind `'return'`, no `jumpTo`, so `drawWires` skips it
  without a special case.
- **`pack{expr}`** — one ordinary number slot, so drag/swap/wrap/tap-edit all
  work inside it for free; `isFocusable` grew a third case and `.block.pack`
  got the socket hues assign/check already had. A `/0` refuses the pack exactly
  as it refuses a write. `scanDivZero` needed NO change — it already walks any
  statement's `.expr`.
- **`unpack{target}`** — LHS `tgt-chip`, so the Phase-10 chooser served it with
  a one-line title change. **Dequeue happens exactly once, in `execStmt` —
  this is why it is a statement and not an expression leaf.** `bubbleExpr`
  re-evaluates expressions to draw the thought bubble, so an impure
  "next parcel" leaf would pop twice per row. Expressions stay pure.

### Control flow
- **`nextPc` is still the only thing that moves pc.** `execStmt` reports
  `{visit:name}` / `{ret:true}`; `nextPc` resolves, pushes/pops, and returns a
  destination index, `null`, or a STRING failure code. Same report/decide split
  the jump path always had.
- **Bookmarks store the call statement NODE, never a row index.** The program
  is editable mid-run; an index rots silently, a node keeps pointing at the row
  you can still see and drag. `program.indexOf(call)` resolves LATE, on every
  return. Deleting that row makes the bookmark DANGLE — the Phase-9 amendment
  (structure always valid, REFERENCES may dangle) applied to a runtime
  reference, third instance of the same rule. **The mutation test proves this
  matters: swapping node→index crashes the suite outright.**
- **One halt surface, five doors into it.** `beepStuck(msg)` is the factored
  body (`beepConfused` / `beepConfusedDivide` are now thin wrappers). A
  `STUCK` map turns nextPc's failure code into Beep's bubble via `haltCode`;
  a mid-statement failure rides `result.stuck` beside `result.divZero`. In
  every case **pc parks on the offending row** so the bug stays steppable:
  return with no bookmark · unpack from an empty belt · return to a deleted
  call row · visit a lost flag · **more than `CALL_MAX` (12) open visits.**
  Recursion works day one, so the cap turns stack overflow from a hang into a
  watchable, teachable failure.
- **State:** `callStack` (of nodes), `belt` (of numbers). Reset empties both.

### Surfaces
- **Bookmark tokens ride the right gutter**, pinned to each visit's RETURN row,
  merged with a count when several share it (recursion). `renderMarks` is
  called from `drawWires`, so every reorder/insert/delete re-pins them with no
  extra wiring. A dangling bookmark draws nothing — there is no row to pin to.
- **The belt is its own side panel** (between backpack and new pieces).
  `renderBelt` paints `belt` directly; the front parcel is marked, a fresh one
  animates in. The panel system picked it up automatically via `setupPanel` —
  fold/reorder/persist/help disc, zero new code. **Help discs 3 → 4** and
  **statement protos 7 → 11**; both counts asserted in `test-phase9` (updated).
  Phase-8's T1/T2 were untouched as predicted (`.proto:not(.stmt-tile)`).
- `DROP_TABLE` / `accepts` needed NO new rows: the `stmt` and `stmt-proto`
  payloads already covered all four. Stage 1+2 of the unified drop model have
  now paid for themselves twice (Phase 11b, Phase 13).

### Pedagogy, deliberately
- **Return address as data:** a goto's arrow is drawn; a return's cannot be.
  The bookmark pile is that invisible thing made countable.
- **Calling conventions, honestly.** Both sides must agree on count and order,
  in both directions, because one belt carries both. Leftovers sit visibly and
  will corrupt the NEXT visit's arguments; unpacking too many halts him;
  packing a result before unpacking all arguments interleaves them. All three
  are visible, none are prevented. (Fallback if it proves too cruel: two belts,
  inbox/outbox. Rejected for now — per-call frames are invisible machinery, and
  the failure modes ARE the curriculum.)
- **FIFO, not a second stack:** parcels come off in the order they went on,
  which is what a child already believes about conveyor belts.

### Verification
`test-call.js` — **72 asserts**: semantics through `stepInstant` over small
programs installed by a new `window.__call` seam (round trip, LIFO nesting,
FIFO belt, a full pack→visit→unpack→pack→return→unpack doubler); every halt
surface incl. deleting the call row mid-visit; the belt and bookmark DOM; and
real gestures for all four prototypes. **Mutation-tested 6/6:** LIFO→FIFO
bookmarks, off-by-one return row, missing overflow cap, double dequeue,
index-instead-of-node bookmarks, LIFO belt. All nine suites green (**491**).

### Still open in Phase 13
- ~~The seed program does not use any of it~~ **and** ~~`ifvisit`~~ — both
  addressed in Phase 13b below. `ifvisit` earned its place immediately: it was
  the single thing blocking every candidate seed refactor.
- **Typed parcels.** The belt is numbers-only. Sprites and booleans would need
  `unpack` to know its target's type; the parcel tiles would just inherit the
  existing type silhouettes.
- **Clamping — a note that was WRONG when first written, kept as a correction.**
  The claim was "unpack ignores the clamp an assign would honour". It cannot:
  `clamp` is a per-STATEMENT field (`clamp:[0,100]`), present on exactly two
  statements in the app (the two `nudgePaddle` rows), and there is no
  variable-level clamp anywhere for `unpack` to read. A shelf-dropped `assign`
  is equally unclamped, so `unpack` introduces no new hole:
  `unpack into paddleX` with a huge parcel slides the paddle out of the
  (overflow:hidden) stage and skips the `'at the edge!'` bubble, exactly as
  `paddleX = 5000` does today.
  **The real question underneath** is that TWO unrelated notions of range
  coexist: the statement `clamp`, and `VAR_META` (`paddleX:{min:0,max:100}`,
  `ballVelocityX:{min:-12,max:12}`) which today only configures the backpack's
  number-input widget. The authoring UI knows paddleX lives in 0..100; the
  interpreter does not. Unifying them = deciding whether the language has
  BOUNDED VARIABLES at all (and whether hitting a bound is silent, a bubble, or
  a halt). That is a phase-sized pedagogical decision, not an unpack fix.

## Phase 13b — `ifvisit`, and the seed program on subroutines — DONE
Phase 13 shipped an UNCONDITIONAL call into a program whose every branch is
conditional, so nothing could actually use it. The grid was half-empty:

|                          | always  | if        |
|--------------------------|---------|-----------|
| one-way (never comes back) | `goto`  | `ifjump`  |
| visit (comes back)        | `visit` | `ifvisit` |

- **`ifvisit{cond,target}` is `ifjump` with one word changed.** Same condition
  slot, same `/0`-refuses-to-decide rule; a yes reports `{visit}` instead of
  `{jump}`, so `nextPc` drops a bookmark. No new machinery in nextPc at all.
- **Its KIND is `'check'`, not its own family.** First attempt gave it kind
  `'ifvisit'` and THREE suites went red: `.block.check` means "a row that asks
  a question" and phase-8/bool/compare all select conditional rows with it.
  Coming back is a MODIFIER, so it is `.block.check.callrow` — sun like every
  check (socket hues inherited for free), dashed like every visit, rope class
  `cond call`. Kind = family; modifier = the twist.
- **A REAL BUG the seed refactor flushed out:** `expectedType` keyed condition
  slots on `s.parent.type === 'ifjump'`, so an `ifvisit`'s condition typed as
  `'number'` and every boolean drop onto it was silently refused — no error
  anywhere. Now keyed on `s.field === 'cond'`, so the NEXT conditional
  statement cannot repeat it. Mutation-tested (reverting it reddens 15 asserts).

### The seed program: the arrow handlers are subroutines now (36 → 35 rows)
    ⚑ start
    if ← isKeyPressed visit ⚑ goLeft      (was: jump goLeft)
    if → isKeyPressed visit ⚑ goRight
    paddle moveTo paddleX                  (the `⚑ move` label is GONE)
    ...
    ⚑ goLeft / paddleX = paddleX − 8 / return     (was: goto move)
    ⚑ goRight / paddleX = paddleX + 8 / return
The win is not the row count, it is that `goLeft` used to be a place you jumped
INTO and then had to jump out of to a THIRD place, which needed a `⚑ move` label
whose only job was to be landed on. As subroutines they hand control straight
back: **one label and two gotos deleted, two returns added.** This is the first
default program where a flag is a TOOL, not a place.
- **Behaviour change, deliberate:** holding BOTH arrows now runs both nudges
  (net zero) instead of letting ← silently win by jumping past the → test.
  Fall-through after the call is the whole point of a call.
- Verified against the pre-refactor build: bricks still all destroyed, paddle
  still clamps to 0 and 100, zero escapes over 3000 steps, bookmark pile always
  returns to 0 (no leaks).

### Why the bounce/brick chain was NOT converted — measured, not guessed
Its **mutual exclusion is load-bearing.** A one-way jump into a handler that
ends `goto start` guarantees at most ONE handler runs per pass. Convert the
callers to `ifvisit` and every MATCHING handler runs, so a ceiling bounce and a
brick hit in the same pass flip `ballVelocityY` **twice** — a net no-op, and the
ball sails through the ceiling. It is reachable, not theoretical: at the top the
ball spans y 0..22 and the bricks 14..30, so an 8px overlap while x also
overlaps a brick is an ordinary event. **Reproduced in a throwaway harness
before deciding** (vY = −3 in, −3 out over a full pass). Fixing it properly
means making the handlers idempotent or separating the axes — a physics
decision, not a call-syntax one. The reasoning is also inline above
`label('bounceX')` so nobody re-tries it blind.

### The belt is still not in the seed, and that is honest
Neither `pack` nor `unpack` earns a place yet. The two arrow handlers differ by
a CONSTANT (±8) that is cheaper to inline than to pass, and parameterising them
would need a **scratch variable** — every backpack variable is load-bearing game
state, so there is nowhere to unpack an argument INTO. The three brick hits are
the refactor the belt was built for, and they are blocked on the belt being
**numbers-only** (`despawn` still bakes a sprite name). Those two — scratch
variables, and sprite parcels — are the real Phase 14 candidates.

### Verification
`test-call.js` grew to **98 asserts** (T19–T25 cover ifvisit: taken/not-taken,
bookmark only on a yes, lost flag, the overflow cap through the ifvisit door,
`/0` in the condition, the shelf drop + condition editing, and the `cond call`
rope). **5/5 ifvisit mutants caught** — `{jump}` instead of `{visit}`, condition
ignored, missing `/0` guard, the `expectedType` regression, and a lost `jumpTo`.
All nine suites green: **517** asserts. Shelf protos 11 → 12.

## Phase 14 — the backpack is a STACK OF POUCHES — DONE
**Terms:** a **pouch** is one entry in the visit stack, drawn as a card in the
backpack panel. Every `visit` pushes one, every `return` pops one, and
`pouches[0]` is **the world** — pinned, never popped, and its notes ARE `state`
(same object identity), so every direct `state[...]` read in the engine (sprite
geometry, the number widgets) kept working untouched. A **note** is a variable
living in a pouch; the eight game variables are simply the world's notes. The
**open pouch** is an always-present staging pouch above the active one: it has
parcels but no label, no notes and no return-ref, and it is deliberately NOT in
the `pouches` array, which makes "invisible to name resolution, exempt from
CALL_MAX" true by construction rather than by filtering.

### The open pouch — Patrick's catch, and the keystone
The first draft gave each frame its own belt. That is a NON-FIX and the doc
said so once it was pointed out: a callee's pouch does not exist when the
caller `pack`s, so the parcels could only land in the caller's own queue —
observationally identical to Phase 13's single global belt, zero isolation
bought. Staging solves it the way real calling conventions do (fill the
frame-to-be, THEN call), and it collapses four verbs into four sentences:
- **`pack e`** → appends to the OPEN pouch. Always.
- **`visit ⚑f`** → the open pouch BECOMES the call's pouch (label + return-ref
  stamped on; the packed parcels are already inside, which IS the argument
  passing); a fresh open pouch stages. An `ifvisit` NO leaves the staged
  parcels visibly waiting for whichever visit fires next.
- **`unpack into v`** → pops the front of the ACTIVE pouch. Always.
- **`return`** → whatever this visit packed and never took anywhere ARE the
  results: appended to the caller's pouch. Its own pouch — unconsumed
  arguments and all — is discarded with the card.
**The conveyor-belt metaphor dissolved entirely**; parcels just live in
pouches, and "pack a pouch, take it on a visit, unpack it when you arrive" is
one story. UI copy followed (`pack X for the visit`).

### Name resolution — one rule, every verb
- **read**: top pouch → down the pile → the world. Missing everywhere sets
  `lostVar` (the `divByZero` idiom exactly), exec refuses, Beep halts confused
  ("a note called n? I do not have one!") with pc parked on the row.
- **write** (`assign` AND `unpack`, identically): the NEAREST pouch holding
  that name — write-through, never an implicit shadow. Name nowhere → create
  in the active pouch (first write is creation; at top level that is the
  world, so top-level notes are world notes, visible and inspectable).
- **`new note ⟨name⟩`** — the ONLY way to shadow, and a DECLARATION, which is
  exactly why real languages have them. Creates in THIS pouch even when the
  name lives below, seeds 0, no-ops if already declared here, refuses world
  names (validator + a runtime guard).
This replaced an earlier draft that gave `unpack` a private write-into-the-top
rule; Patrick's version is strictly better because the "world names are never
shadowable" EXCEPTION it needed simply evaporates — writing `paddleX` from any
pouch reaches the world because that is where the name lives. **When a rule
change makes an exception disappear, take the rule.**

### What this unlocks: factorial, which Phase 13 could not express
    ⚑start / pack 5 / visit factorial / unpack into ballX / goto done
    ⚑factorial / new note n / unpack into n
    if n < 2 jump base
    pack n − 1 / visit factorial / new note sub / unpack into sub
    pack n × sub / return
    ⚑base / pack 1 / return
    ⚑done
Verified 3!/5!/6! = 6/120/720 with a clean unwind (0 pouches, 0 staged).
**Delete either `new note` and it returns 1** — every depth write-throughs onto
one shared `n`. That clobber is a TEST (T17), not a footnote: the stack UI
makes it watchable, so the declaration is the fix a learner reaches for at the
exact moment recursion demands it.
**Isolation is now a provable property** (T18): a callee handed an empty open
pouch cannot see its caller's leftovers — Phase 13's nastiest failure mode is
structurally impossible. A callee's own leftovers die with its pouch (T19).
**The FIFO wrinkle survives in one place only** (T19b): an UNDELIVERED result
sitting in your own pouch queues ahead of the next call's result. Same
count-agreement lesson, localized to one visible card.

### UX
One panel: the backpack IS the stack. Ghost card on top (what you are packing
for the next visit — it answers "I packed it, where did it go?" by being where
it went), visit cards in the middle with their ⚑ title and ↩ return chip, world
card pinned at the bottom with the only LIVE inputs (pouch notes render
read-only; shadowed ones are struck through). A **two-state toggle** in the
panel: *this pouch* (the pile) and *all in reach* (one merged list, nearest
pouch wins, shadowed entries struck through, each row labelled with the pouch
it came from) — dynamic scope in a single glance. The separate "Parcel belt"
panel is gone; `renderPack`/`renderBelt` collapsed into `renderStack`.

### Engineering notes
- `pouches` + a separate `open`; `callStack` and `belt` deleted. Bookmark
  gutter tokens now read `pouches.slice(1).map(p => p.ret)` — still NODES, not
  indices (the Phase-13 idiom, still mutation-proven).
- Reset empties the pile and the parcels AND deletes any note the program
  invented at top level, then restores the world's start values.
- **Gameplay is byte-identical to pre-Phase-14** across idle/left/right runs
  (paddle clamps, brick destruction, zero escapes, identical ball positions) —
  the point of frame 0 sharing `state`'s identity.
- Statement protos 12 → 13 (`new note`). Panels 5 → 4; help discs stay 4.

### Verification
`test-call.js` **REWRITTEN, 128 asserts** (the Phase-13 pack/unpack tests are
gone by design, not preserved): staging semantics, FIFO within a pouch, LIFO
nesting, the resolution matrix, `new note` shadowing and its refusals,
factorial with and without declarations, isolation, the FIFO wrinkle, every
halt (empty pouch, no bookmark, deleted call row, lost flag, overflow, unknown
name), the card DOM, the reach view, Reset, and the gestures.
**11/11 mutants caught**, including both rejected designs: writes creating a
top-pouch shadow (9 failures), `pack` appending to the active pouch (30),
`return` delivering into the new open pouch (15), world-first read order (5),
`new note` writing through (crash), results prepended, leaked arguments,
missing-name-reads-0, and a poppable world.
All nine suites green: **547** asserts.

### Still open
- **The seed program still does not use notes or parcels.** Phase 13b's
  blocker (no scratch variables) is GONE — `new note` is exactly that — and
  Phase 15 gave `despawn` a real sprite slot, so the three brick hits are now
  blocked ONLY on sprite-valued parcels.
- A loadable factorial EXAMPLE (content, not code — the app has no
  program-switching UI, which is its own small feature).
- Named parameters on the pouch card ("expects: n") — a contract surface that
  falls out naturally now that cards exist.
- Tail calls (the pile that never grows); typed notes; palette tiles for notes.

## Phases 15 & 16 — every sprite is a VALUE now (`despawn`, then `moveTo`) — DONE
### Phase 15 — `despawn` takes a SPRITE, not a name
The last place a sprite was still a string baked into a statement. It is a real
slot now: `despawn{sprite:<sprite node>}`, so a pill drags into it, `x of` and
it share the same material, and a sprite can arrive from anywhere a sprite
expression can. This was the Phase-12 loose end and Phase 14's stated blocker.

- **`expectedType` needed ONE line, keyed on the FIELD:** `s.field === 'sprite'`
  → `'sprite'`, replacing the list of parent types (prop/alive/edge all use that
  field; touch/closing keep their `left`/`right` by parent type). **This is the
  second time that exact lesson has paid** — `cond` taught it in Phase 13b, when
  `ifvisit` silently got number-typed conditions. Key slot types on the FIELD.
- `execCommand` EVALUATES the slot (`evalExpr(node.sprite)`) instead of reading
  a field; `cloneStmt` deep-clones it; `isFocusable` grew a despawn case;
  `focusedHtml` renders the slot; `.block.action` got the socket hues.
- **A landmine was defused.** Phase 10's `openSpritePop` (repoint despawn's
  baked field) and Phase 12's `openSpriteValuePop` (edit a sprite VALUE) were
  twin same-named-ish choosers; the doc's own "Gotcha found the hard way" is
  about exactly that duplicate-declaration hazard. The Phase-10 one is now
  DELETED along with the `.sprite-chip` class — despawn's sprite answers to the
  same pill tap as every other sprite. One name, one meaning.

### A pre-existing bug found by the test noise
`wireZing` captured the STATEMENT and re-read `b.wireEl` inside its 720ms
timer; Reset and `__call.load` both null that field, so the callback threw.
Uncaught in a timer, so no assertion ever failed — it showed up only as 31
stray TypeErrors in test output at HEAD (59 after this phase's extra loads).
Fixed by holding the ELEMENT rather than a path to it, same for two `nb.el`
zap timers. **Test output is now 0 exceptions across all nine suites** — worth
keeping that way, since this class of bug is invisible to assertions.

### Verification
`test-sprite.js` 77 → 83: despawn exposes a live slot, a dragged pill replaces
it, running it despawns whatever the SLOT holds (and follows an edit), and
**T13b** — edit the seed row, Reset, assert the original sprite returns, which
is the only test that catches a shared (non-cloned) sprite node corrupting the
`programSeed` snapshot. `test-phase9` T16 rewritten to the pill gesture.
**4/4 despawn mutants caught** (name-not-evaluated, sprite slots untyped,
shared clone, not focusable) — the shared-clone one MISSED until T13b was
written, which is why it exists. All nine suites green: **555**. Gameplay
byte-identical to HEAD across idle/left/right runs.

### Phases 16–17 — ONE `move <sprite> to <x>, <y>`, with explicit coordinates
**Phase 16 was a design decision taken without asking, and it was the wrong
call to make unilaterally.** Collapsing `movePaddle`/`moveBall` into
`moveTo <sprite>` looked like the same mechanical fix as despawn, but it
QUIETLY KEPT the real problem: the engine still derived every sprite's
position from variable NAMES (`ballX`/`ballY`, `paddleX` plus a pinned bottom,
`brickNX` plus a fixed row). That is this one example's naming convention
baked into the language. Patrick's correction (Phase 17): **the parameters
must be explicit**, because the goal is that anything be expressible.

**The model now:** a sprite OWNS its position (`spritePos`, logical 0..100 for
all five). Variables are just numbers the program manipulates. `move` is the
one moment a variable's value is pushed into a sprite. Nothing in the engine
reads a variable by name to find out where something is — the convention lives
in the PROGRAM, which says `move ball to ballX, ballY`.
- **`{type:'command', name:'move', sprite, x, y}`** — three real slots, and the
  coordinates are ordinary number expressions, so `move ball to brick2X + 4, 20`
  works. `x of` / `y of` read the sprite, so they compose straight back in.
- **`spriteXY` / `ballBox` / `paddleBox` / `brickBox` all collapse into one
  `boxOf(name)`** over the store; `placeBricks` and the old per-name `moveTo`
  renderer are gone, replaced by `drawSprite` / `drawAllSprites`.
- **The paddle's y is a LITERAL in the seed** (`move paddle to paddleX, 95`),
  Patrick's call. It used to be pinned by the renderer, which is exactly why
  no program could ever move the paddle vertically. Cost: it no longer
  re-pins on resize. Gameplay is nonetheless **byte-identical** to HEAD across
  idle/left/right runs — 95 vs the computed 94.74 changed no collision.
- **A CONSEQUENCE WORTH KNOWING:** typing a variable in the backpack no longer
  teleports its sprite. Positions are the sprite's own and only `move` changes
  them, so the stage catches up the next time that row runs (instantly during
  Play; visibly lagging when paused). That is the honest reading of "the
  program moves things" and it is the price of any-variable-drives-any-sprite.
- Fresh shelf statement is an **identity**: `move ball to x of ball, y of ball`
  changes nothing until tuned — the always-valid invariant, honoured with
  pieces that already existed. Shelf protos 13 → 12.
- `collectDivZero` / `stmtOfNode` walk `b.x` / `b.y`, so a `/0` in a coordinate
  refuses the move and parks Beep exactly as it does in an assign.
- `test-sprite.js` 88 → 94 and `test-diverror.js` 15 → 18. The geometry tests
  had to be rewritten: they used to set `state.ballX` and read `x of ball`,
  which SILENTLY encoded the old coupling. **T13e is the new keystone** —
  setting a variable does not move the sprite; the `move` row does.
  **6/6 move mutants caught** (coordinates ignored, x/y swapped, spriteXY
  reading names again, no redraw, `/0` let through, coordinate slots not
  cloned). All nine suites green: **569**.

### Still open
- **Sprite-valued parcels** — pouches are still numbers-only, so the three
  brick hits still cannot be one routine. This is the SINGLE remaining blocker:
  `pack brick1` / `unpack into <sprite note>` would finish it, which needs
  typed notes as well as typed parcels.
- **`spriteVel` is the LAST convention-bound thing left.** It still reads
  `state.ballVelocityX/Y` BY NAME, so `isClosingOn` only really works for the
  ball. Now that sprites own their positions, the fix the doc has proposed
  since Phase 12 is finally cheap: cache each sprite's position per pass and
  derive velocity from the delta — convention-free, works for any sprite moved
  by any means.
- **A plain-English pass over all syntax** is planned (Patrick): the language
  should read like `move ball to 10, 20` rather than like code. `move` was
  named with that in mind; `pack`/`unpack`/`visit` will want revisiting.

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
  - ~~**Still open in Phase 12:** despawn's sprite and the movePaddle/moveBall
    commands still bake a sprite NAME~~ **DONE in Phases 15 & 16** — all three
    became sprite SLOTS, the two move commands collapsed into one
    `moveTo <sprite>`, and the Phase-10 chip chooser was retired. See below.
