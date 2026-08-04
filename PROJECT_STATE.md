# Beep — project state & handoff

Beep is a block-based pedagogical language. A robot ("Beep") runs a Breakout game
one AST node at a time, and the whole point is that the learner can directly
manipulate that AST through the UI. This note is a handoff so any fresh session can
resume without re-deriving context.

**Detail in this doc tapers with age on purpose:** recent phases keep their
reasoning, old ones keep only what is still true and still load-bearing.

## Where the work lives
- **Active file:** `beep.html` (single self-contained HTML file). Every phase is
  documented inline with a comment block explaining its invariant.
- **Preview:** the in-app split view shows blank; test by opening the .html in a
  real browser (it needs real JS + keyboard/pointer input).
- **Persisted:** `beep.html`, this file, the ten `test-*.js` suites, `fp3.js`,
  `package.json` (+ lockfile).
- **Generated — recreate, don't commit:** `node_modules` (`npm install`),
  `beep-extract.js` (script extraction for `node --check`), any `patch*.py`
  (one-shot edit scripts, already applied).

## The guiding invariant (do not break)
**Always-valid program:** no empty slots, no dangling required fields, ever. New
material arrives pre-filled with an identity default; any removal leaves a complete
substitute behind.

**Amendment (Phase 9, deliberate):** STRUCTURE stays always-valid, but a
REFERENCE may dangle — a jump to a deleted label renders frayed with its wire
hidden, and Beep stops confused if he tries it. The broken program stays
runnable and steppable, so the bug is visible rather than prevented. This has
since applied to runtime references too (Phase 13 bookmarks) and to a var whose
`new note` declaration is deleted (Phase 18) — four instances of one rule.

Corollaries the whole codebase leans on:
- **One tree, three views:** display (`renderStmt`/`nodeHtml`), values (`bubbleExpr`),
  and behaviour (`evalExpr`/`execStmt`) all derive from the same node. Never
  special-case the visuals — mutate the node and let all three follow.
- **Direct manipulation** over modal forms; every edit is a gesture on the thing.
- **Reset = deep-clone snapshot.** `_initialExpr`/`_initialCond` (per statement) and
  `traySeed` are cloned at init; any new mutable field must be covered by them.
- **Type safety** via `typeOf` / `expectedType` / `compatible`; every create/place
  path routes through it.
- **Key slot types on the FIELD, not the parent type.** This has bitten twice and
  silently: `ifvisit` conditions typed as number (Phase 13b) and despawn's sprite
  slot (Phase 15). `s.field === 'cond'` / `s.field === 'sprite'`, not a list of
  parent types. **The one honest exception is `expr`**, which three statements
  share and type differently — a `note`'s seed is `'any'`, a `pack`'s is `'any'`,
  an `assign`'s is its TARGET's type. When a field name genuinely means different
  things in different statements, key on the parent; the rule is "key on whatever
  actually decides", and for every other field that is the field.

## AST model (quick reference)
- **Statements:** `label`, `goto`, `ifjump`, `ifvisit`, `visit`, `return`,
  `assign`, `command`, `pack`, `unpack`, `note` (`new note n = ⟨seed⟩`), `empty`
  (`empty the pouch I am packing`), `add` (`add ⟨sprite⟩ to the scene`). The
  control-flow grid is
  (one-way | comes-back) x (always | if) and all four cells are filled:

  |                            | always  | if        |
  |----------------------------|---------|-----------|
  | one-way (never comes back) | `goto`  | `ifjump`  |
  | visit (comes back)         | `visit` | `ifvisit` |

- **Expressions:** `num`, `var`, `bin{op,left,right}`. Booleans: `key`, `bool{value}`
  (literal), `cmp{op,left,right}` (boolean-typed, but its OPERANDS are numbers),
  `not{operand}` (the only UNARY node), `touch{left,right}`, `closing{left,right}`,
  `edge{sprite,edge}`, `alive{sprite}`. Sprites: `sprite{name}`, `prop{prop,sprite}`
  (`x/y of`), `new{cls}` (`a new ⟨Class⟩` — the one EFFECTFUL expression). A
  `bin` is BOTH number and boolean material: it takes its type from
  its op (`+` number, `and` boolean).
- **Constructors:** `v`, `num`, `bin`, `keyCond`, `cmp`, `bool`, `notOf`; builders
  `label/goto_/…`.
- **Eval/render:** `evalExpr`, `execStmt`, `renderStmt` (compact), `nodeHtml`
  (editable/draggable), `htmlExpr` (compact expr), `bubbleExpr` (values substituted).
- **Slot registry:** `slotReg` maps id → `{parent, field}`; `reg` / `slotNode` /
  `setSlotNode` / `slotIdOf`. Rebuilt on every `renderSlots`. Every `bin` registers a
  `selfId` used by the operator's `data-op` AND (nested) the group's `data-sl`.
- **Palette:** `PALETTE` entries are `{kind:'value', make}` | `{kind:'op', op}` |
  `{kind:'stmt', make}`; the variable tiles derive from `VARS`.
- **Testing seams:** `window.__lang` (evaluation), `window.__drop` (verb table +
  gate), `window.__call` (install a small program and drive it with `stepInstant`).

**Counts asserted by the suites** (bump them when the shelf grows): **40** piece
prototypes (`.proto:not(.stmt-tile)`) = 1 num + 2 keys + touch + edge + closing
+ 3 readings + 2 yes/no + 6 comparisons + 7 ops + **3 `a new ⟨Class⟩`** +
**13 NOTE tiles** (8 numbers + 5 sprites); **14** statement prototypes; **5**
side panels (Stage / **classes** / backpack / new pieces / spare tiles); **5**
help discs.
**Only 24 of those 40 are static, and none of them is a variable.** The class
tiles (`refreshClassTiles`, `data-newcls`) track however many classes exist, and
every variable pill is a note tile (`refreshNoteTiles`, `data-note`) tracking
whatever the PROGRAM declares — the five static sprite pills retired in Phase
20d, the eight variable tiles in 20e. Load a different program and both groups
change; that is the Phase-8 promise, not a bug.

### The four slot types
`number` · `boolean` · `sprite` — and `any`, which is not a value type at all:
no expression ever HAS it. It is what a SLOT says when it will take anything, and
exactly two slots say it (a declaration's seed, and `pack`'s). `fits(valType,
slotType)` is the one place that knows.

## THE TYPE RULE FOR BINS — read this before adding an operation
**A `bin` may host an op iff `in === out`.** That single rule decides where every
new operation goes, and it is the always-valid invariant applied to `bin`:
collapsing a bin replaces it with one of its operands, so unless the op preserves
its type, collapse would leave something of the wrong type in the slot. Hence:
- `+ − × ÷` (number→number) and `and or` (boolean→boolean) are ordinary bin ops,
  live in `OPS`, and arrive by **in-place wrap** — the palette op-tile drag and the
  chooser's "wrap in" section both derive from `OPS`, so adding one is one entry.
- a **comparison** is number→boolean, so it can NEVER be a bin — its own node type
  (`cmp`), delivered as a palette VALUE prototype dropped into a boolean slot. The
  same route carries the two sprite bridges (`prop`, `alive`).
- **`not`** is boolean→boolean but UNARY, and has no identity, so it breaks the
  other two `bin` assumptions instead. Own node type, own one-entry `UNARY_OPS`
  registry, unioned into `opsFor`, and `wrapNode` branches on `o.unary`.

`typeOf(bin)` and `expectedType(bin operand)` both read the op registry via
`opSig`, which is what makes the same `bin` machinery serve both worlds.

### Registries (all built for scale — adding an entry is the whole change)
- **`OPS = [{op, identity, in, out}]`** — `+`,`−` (id 0), `×`,`÷` (id 1),
  `and`,`or` (id true/false). `FLIP` pairs same-type toggle partners (`+`↔`−`,
  `×`↔`÷`) for the operator tap-menu. `opsFor(node)` filters by
  `in === typeOf(node)` AND `out === expectedType(slot)` — two-sided, so in-place
  wrap can only ever be type-preserving.
- **`CMPS`** — `<`, `>`, `<=`, `>=`, `==`, `!=`; `cmpGlyph` maps stored spelling to
  the maths glyph (`≤ ≥ = ≠`); `CMP_FLIP` pairs each test with its logical
  NEGATION, which the operator menu's "the opposite" applies. Deliberately
  SEPARATE from `OPS` — comparisons are not wrap material.
- **`UNARY_OPS`** — `not` only.
- **`LEAF_CHOICES`** — one entry per node type whose chooser just writes a field
  from a list (`var`, `sprite`, `prop`, `bool`, `edge`): `{title, field, options}`.
  `openChoicePop` is the only body. `handleOnly` marks the two that open from
  their handle rather than from a tap on the piece (`prop` from the "x of" glyph,
  `edge` from the chip); `plain` skips the wrap/take-out sections for a constant.
  **`openPredPop` is deliberately NOT in here** — picking a sensor REPLACES the
  node through its slot instead of writing a field, and folding that in would
  put a second code path back inside the shared body.
- **and/or evaluate EAGERLY — no short-circuit, deliberately.** The thought bubble
  prints both operands' values, so a half-evaluated expression would show Beep
  reporting a value he never actually read.

### Shared shells (say a thing once)
- **`hexHtml(kind, selfId, node, inner)`** — the gold hexagon every boolean piece
  wears (`touch`, `closing`, `edge`, `alive`, `bool`, `cmp`, `key`). Outer span is
  the border ring and the drag/tap target, inner span the fill; only the contents
  differ. A new boolean node type inherits the silhouette by asking for it.
- **`boxOf(id)`** — the ONE geometry function. Phase 17's `ballBox`/`paddleBox`/
  `brickBox`/`spriteBox` had all decayed into `return boxOf(name)` and are gone;
  `__lang.spriteBox` still points here so the suites read naturally. Phase 20
  pointed it at the INSTANCE's position and its CLASS's size; it still knows no
  names.
- **`classStyleText(c)`** — a class as one inline style string. The card's
  swatch and every live instance are painted from this same call, so a look
  cannot drift between the panel and the stage.
- **`exprFault(flash)`** — one place asks "did evaluating that go wrong?" (`/0`,
  a name nobody has, a deleted class). Six statements call it, so the next
  failure mode is one line rather than six.
- **`clearRunMemory()`** — a run's memory dies with the run. Both doors into a
  fresh run (the Reset button, the `__call.load` seam) go through it, so they
  cannot drift apart.
- **`popSection(title)` / `commitThen(fn)`** — a titled chooser sub-section, and
  the "flush the half-typed number before acting" wrapper both "wrap in" and
  "take out" need.
- **`numRow(pop, spec)`** — THE number control, `[ − ] [ field ] [ + ]`. It was
  the body of `openNumPop` and nothing else could reach it, so when the class
  editor grew numeric options they arrived as button lists: a second way to say
  the same thing, which is how two controls drift apart. One silhouette, one
  stepping rule, one clamp, whoever is asking. `spec.onLive(n)` is for editors
  that follow every keystroke (the class swatch does; a number literal commits
  on close).
- **`otherButton(e)`** — every pointerdown handler asks the same question first;
  `stmtDragOpens(e)` is the fuller prologue the two statement-drag doors share.

## Gesture map (current)
- Grip drag → reorder statement / Trash (delete; referenced labels confirm first) /
  tray (stash). Activation counts TOTAL movement (x+y) and the ghost follows both
  axes, so a sideways pull toward the right-panel zones works.
- Grip tap → statement menu: duplicate / to spare tiles / delete.
- Body tap → focus/unfocus statement.
- Drag operand → swap (compatible slot) / collapse (Trash or spare-tiles open area) /
  snap home. Drag a spare tile → Trash removes it.
- Tap operand (num/var/pred) → chooser (edit value) + "wrap in" + "take out" sections.
- Tap operator → bin menu: flip sign + "wrap in" (wraps whole subtree).
- Tap a comparison's operator (or its hexagon) → pick the test / "the opposite".
- Drag an `and`/`or`/`not` op tile onto any boolean piece → wraps it. Tap a `not`'s
  handle → "remove the not". Drag a comparison hexagon onto a condition → it
  REPLACES the sensor there (which retreats to the spares).
- Tap a chip → repoint the reference: flagref = retarget (a visit's too), flag =
  rename, assign/unpack LHS = pick variable, edge = pick edge.
- Drag a sprite PILL onto any sprite slot (`isTouching`, an edge test, `x of`,
  `is alive`, `despawn`, `move`). Tap a pill → pick another sprite. Tap "x of" →
  x or y.
- Drag palette prototype → ghost copy: drop on compatible slot (replace; old piece
  to spares) / tray area (mint tile) / a piece, if an op tile (wrap) / Trash (cancel).
- Drag statement prototype / stashed statement tile → real block under the pointer,
  reorder-style gap; drop places it (fresh jumps bind to nearest flag).

## Phases 1–12 — settled; what's still true
Editing gestures and the type system. Detail lives in the inline comment blocks;
this is the summary a fresh session needs.

1–4. **Statements are data, edits are drags.** Grip handles reorder; the evaluator
walks nodes, not closures; every operand drop SWAPS two nodes (no empty slots);
whole `bin` subtrees drag, not just leaves.

5–7. **Typed, shaped, growable.** Booleans are gold hexagons, numbers teal boxes,
sprites coral pills — silhouette tells you the type before you read it. Tap a leaf
for a chooser popover (numbers allow decimals, clamped only to JS safe-integer
range). **Prune:** drag an operand to Trash or the spare-tiles area → confirm dialog
previews `bin → leftover operand`; required-slot operands refuse. **Grow:** pull-based
and type-filtered — the OPERATOR IS THE BIN'S HANDLE; wrap seeds the op's identity so
behaviour is unchanged until the fresh (flashed) operand is tuned.

8. **Palette = infinite typed source.** `#palette` is a static prototype shelf built
once; Reset ignores it. Drag = mint (pointerdown clones a ghost + `item.make()`; the
prototype never leaves). **Value drop REPLACES** — the displaced node retreats to the
spare tiles, material is never lost. **Op tile drop WRAPS.** **Trash = cancel** for a
fresh piece. New op or variable ⇒ its palette tile appears automatically.

9. **Statements are material too** — add / delete / duplicate / stash. Shelf
statements are identity no-ops; jumps carry `target:'?'` and **bind to the nearest
flag below on drop** (`bindJumpTarget`). A shelf/tray statement is ARMED on
pointerdown and becomes a REAL block on the first 6px of movement
(`armMaterializedDrag` → `materializePending`), then rides the ordinary reorder
machinery; **a tap creates nothing at all.** ONE tray holds both statement tiles
(`.stmt-tile`, never in `slotReg`) and expression tiles. Reset restores the whole
LIST from `programSeed`.
- **A DRAG BEGINS ON MOVEMENT, NOT ON CONTACT** — and it did not, until a bug
  report. The original built the block on pointerdown and set `active` straight
  away, which shipped two symptoms of one mistake: a plain tap on a shelf
  statement APPENDED it to the end of the program (pointerup took the commit
  path, and the `unmaterialize` "put it back" branch was **unreachable dead code
  the whole time** — this doc even described it as working), and the row
  appearing on contact grew the program column, which shoves the sticky side
  column down the page whenever it is scroll-clamped against the taller half of
  the grid. Arming and waiting kills both: nothing exists until the pointer has
  travelled the same 6px every other block drag asks for, so a tap has nothing
  to undo. The value prototypes have always worked this way (`onPaletteDown`
  lifts a ghost; the tree is only touched on a real drop).
- **The block-drag listeners live on `document`, and that is load-bearing.** They
  used to be on `blocksBox`, which worked only because a drag captured the
  pointer on a grip INSIDE it. An armed prototype captures on its SHELF TILE, in
  the side column, so its moves bubble up the other branch of the tree and the
  drag would never activate. `onSlotMove` has always listened on `document` for
  the same reason. **The suite nearly missed this**: `dragStmt` dispatches on
  `blocksBox`, which bubbles to `document` either way, so it cannot tell the two
  wirings apart — T2d dispatches on the shelf tile instead, where the capture
  actually puts the events.
- **The nemesis:** confirming deletion of a wired flag runs a show first
  (`nemesisZap`) — Beep's rival drops in at the flag, glides to each holder jump,
  zaps its rope, leaves, and only THEN does `removeStmt` run. The data change is
  identical, just postponed (~1.6s + 0.84s per extra rope). **Tests must wait ~2s
  after confirming.** `nemesisBusy` guards re-entry.

9b. **Reachable zones.** Every side panel folds (tap its `.panel-head`) and reorders
(drag the head; ≥6px total movement distinguishes drag from tap). Order + folded
state persist in localStorage `beepSidePanels`; `initPanels` only honours keys that
still resolve to a panel, so dead keys need no migration. Pure DOM moves, so element
identity survives and zone rects are untouched. **A folded Spare-tiles panel means a
0x0 zone rect — drops there simply miss (no crash); the chooser menus are the
fallback.** Each panel's explanation is MOVED at init into a `.help-pop` behind a
?-disc. Stage + transport are ONE panel; Step / Play / Reset carry inline SVG
transport glyphs and `faceBtn` swaps the play button's whole face. `mode` is
`idle | play` (watch mode was dropped — Step already covers it).

10. **Chips are references; tapping one repoints it** (delegated in CAPTURE phase on
blocksBox so a chip tap never doubles as a focus toggle). flagref → retarget chooser
(also repairs dangling jumps, and offers "+ new flag below"); flag → **rename-as-
refactor** (`renameLabel` — every jump in the program AND in the tray follows;
`validFlagName` enforces letters/digits, ≤12 chars, unique; names remain the
identity, no id migration); assign LHS → variable chooser. Interactive chips get
hover rings; condition/bubble chips stay inert.

11. **Grammar.** 11a `×`/`÷`. 11b comparisons (`cmp`, the number→boolean bridge; its
operands are ordinary number material so drag/swap/tap-edit/wrap all work inside the
hexagon for free). 11c `and`/`or`/`not` plus the boolean LITERAL — which existed
because wrap needs an identity to seed, and the identity of `and` is yes, of `or` is
no. A boolean `bin` or `not` renders as a gold `.group.boolgroup`: the box is
coloured by TYPE, so a glance says what a subtree yields wherever it sits.
- **Divide by zero is an ERROR, not a silent 0.** `evalExpr` sets a `divByZero` flag
  (still returns 0 so sprite math stays finite until the caller halts) and the write
  is refused. Two surfaces: **(authoring)** `checkDivZeroEdit` scans program+tray
  after every edit and a NEW `/0` summons the **nemesis as a warning**
  (transition-tracked via `knownDivZero`, fires once per creation); **(runtime)**
  Beep stops confused with pc parked on the broken row.

12. **The SPRITE type.** A sprite used to be a name STRING baked into a statement;
it is a VALUE now (`sprite{name}`, `typeOf` → `'sprite'`). Two BRIDGES off it, each
its own node type delivered as a palette VALUE prototype exactly as `cmp` is:
`prop{prop,sprite}` (`x/y of`, sprite→number) and `alive{sprite}` (sprite→boolean —
this closed a real gap: you could `despawn` a brick but never TEST for it).
`isTouching` became a relationship between TWO sprites (`touch{left,right}`), with
`closing{left,right}` (`isClosingOn`) as its companion — overlap and approach are two
separate questions. `edge{sprite,edge}` handles the four view edges, where the EDGE
is a CHIP, not a fourth type: four constants, never computed, never stored, never
the result of anything.
- **Death semantics** (`spriteAlive` map; `despawnSprite` / `respawnAll` on Reset):
  a dead BALL registers no touches at all; a dead TARGET makes that one touch false;
  and **variables keep computing after their sprite dies** — deliberate, because the
  numbers are the program's, not the sprite's.

### TOUCHING IS PURE OVERLAP — the guard lives in the PROGRAM
`isTouching` answers exactly one question and answers it the way a learner would:
are these two in the same place? No velocity anywhere in it. The approach guard that
stops the ball sticking is a SEPARATE predicate and the **seed program applies it
explicitly** — edge rows use a plain comparison on the velocity variable, the paddle
row uses `isClosingOn`, bricks need no guard at all (a hit despawns the brick so it
cannot fire twice). Without a guard, a ball that overshoots an edge flips its
velocity every pass and oscillates in place forever. The point is that the rule
keeping the ball alive is readable, editable program text rather than a hidden
engine rule.

**`isClosingOn` must be judged PER COLLISION AXIS — do not go back to a dot
product.** A plain `dx*vx + dy*vy` over the centre line is wrong for overlapping
boxes and shipped a real gameplay bug: overlapping boxes have a TINY gap on the axis
they collided along and a large one on the other, so the irrelevant axis dominates
the sum and a ball falling onto the paddle while drifting sideways passed straight
through it. The fix picks the collision AXIS first (shallower penetration = the axis
just crossed) and asks about that axis alone. `test-sprite.js` T9/T9b/T9c are the
regressions; **T9b fails loudly if the dot product comes back.** Found by PLAYING the
game, not by the suite — the sprite tests all had the ball moving straight down.

### Gotcha worth keeping
Duplicate function declarations are legal JS — the later one silently wins — so a
new same-named chooser once hijacked an old one with no syntax error and no test
failure until a DOM test drove it. **`node --check` cannot catch this class of bug;
only a test that actually taps the thing can.** (Phase 15 defused the last instance:
the Phase-10 `openSpritePop` is deleted and every sprite answers to the same pill tap.)

## Unified drop model (Stages 1 + 2 DONE; Stage 3 deferred by design)
Three parallel drag subsystems had accreted, each fusing payload, targets, and
resolution. The fix separates three concerns, and the valuable seam has landed:

1. **Payloads** (closed set): `piece`, `proto-value`, `proto-op`, `stmt`,
   `stmt-proto`, `panel`. Each declares only its lift visual — presentation, not logic.
2. **`accepts(payload, target)`** is the ONE gate and **the home of the always-valid
   invariant**. It type/cycle-checks slot targets (delegating to `dropAllowed`) and
   reads a payload-only `ZONE_ACCEPT` map for zone/gap targets. `payloadOf` turns a
   live drag descriptor into a payload string. Both drag systems call it for BOTH
   highlight and resolution.
3. **`VERBS` + `DROP_TABLE`** (payload x target → verb) with `verbFor`: `swap`,
   `replace`, `wrap`, `insert`, `stash`, `discard`, `collapse`, `remove`. Every pair
   maps to exactly one verb; the table IS the drop model. Dialogs are verb middleware
   (collapse and remove-of-a-wired-label confirm first; the nemesis is post-confirm
   theater on `remove`). Menus stop mirroring drop outcomes by hand — the chooser and
   grip menu invoke verbs directly via `appendZoneSection`.

Highlight follows `accepts`, the verb comes from `DROP_TABLE`, so **a zone can accept
a drop yet fire no verb** (a fresh palette piece over Trash is a consumed no-op
cancel). A `window.__drop` seam exposes it to tests.

**It has paid for itself three times:** comparisons (11b), sprites (12), and all four
Phase-13 statements needed **no new payload, no new target, no new table row.**

**Stage 3 (merging the two pointer loops into one lifecycle) is intentionally NOT
done.** Pieces and statements genuinely differ in hit-testing, and `panelDrag` is
chrome, not language material — forcing them together buys coupling over clarity.
Verbs + gate are where the value was. Revisit only if a phase actually demands it.

Why verbs are still the seam to build on: an **undo stack** is a log of executed
verbs + inverses (swap is self-inverse; replace remembers the displaced node; remove
remembers stmt + index), and **JSON export/import** serializes the same tree the
verbs mutate. Both are cheap — everything is already plain data.

## Phase 13 — visits (calls), bookmarks, parcels — DONE
A flag was a PLACE. It is a TOOL now: `visit ⚑x` goes there and remembers the way
back, `return` takes it. **A call is a protocol the learner assembles (pack · visit ·
unpack), not an atomic thing the language does for them.**

Vocabulary (CS name in parens): `visit ⚑` (call) · `return` · the bookmark pile
(call stack) · `pack ⟨expr⟩` / `unpack into ⟨var⟩` (enqueue/dequeue).

### The four statements
- **`visit{target}`** — sets `jumpTo`, and that ONE line is why it inherited
  everything: wires, the holder scan, rename-as-refactor, `bindJumpTarget`, the
  retarget chooser, the frayed-dangle rendering, the nemesis. Its rope is dashed —
  a trip you come back from.
- **`return{}`** — **chipless and wireless on purpose.** Where it goes is DATA (the
  top bookmark), not syntax, so there is nothing static to draw, and that absence is
  the lesson. Kind `'return'`, no `jumpTo`, so `drawWires` skips it without a special
  case.
- **`pack{expr}`** — one ordinary number slot, so drag/swap/wrap/tap-edit work inside
  it for free. `scanDivZero` needed NO change — it already walks any statement's `.expr`.
- **`unpack{target}`** — LHS `tgt-chip`, served by the Phase-10 chooser.
  **Dequeue happens exactly once, in `execStmt` — this is why it is a statement and
  not an expression leaf.** `bubbleExpr` re-evaluates expressions to draw the thought
  bubble, so an impure "next parcel" leaf would pop twice per row. Expressions stay pure.

### Control flow
- **`nextPc` is still the only thing that moves pc.** `execStmt` reports
  `{visit:name}` / `{ret:true}`; `nextPc` resolves, pushes/pops, and returns a
  destination index, `null`, or a STRING failure code. Same report/decide split the
  jump path always had.
- **Bookmarks store the call statement NODE, never a row index.** The program is
  editable mid-run; an index rots silently, a node keeps pointing at the row you can
  still see and drag. `program.indexOf(call)` resolves LATE, on every return. Deleting
  that row makes the bookmark DANGLE — the Phase-9 amendment applied to a runtime
  reference. **The mutation test proves this matters: swapping node→index crashes the
  suite outright.**
- **One halt surface, five doors into it.** `beepStuck(msg)` is the factored body
  (`beepConfused` / `beepConfusedDivide` are thin wrappers); a `STUCK` map turns
  nextPc's failure code into Beep's bubble via `haltCode`; a mid-statement failure
  rides `result.stuck` beside `result.divZero`. In every case **pc parks on the
  offending row** so the bug stays steppable: return with no bookmark · unpack from an
  empty pouch · return to a deleted call row · visit a lost flag · **more than
  `CALL_MAX` (12) open visits.** Recursion works day one, so the cap turns stack
  overflow from a hang into a watchable, teachable failure.
- **Bookmark tokens ride the right gutter**, pinned to each visit's RETURN row, merged
  with a count when several share it (recursion). `renderMarks` is called from
  `drawWires`, so every reorder/insert/delete re-pins them with no extra wiring. A
  dangling bookmark draws nothing — there is no row to pin to.

## Phase 13b — `ifvisit`, and the seed program on subroutines — DONE
Phase 13 shipped an UNCONDITIONAL call into a program whose every branch is
conditional, so nothing could actually use it.

- **`ifvisit{cond,target}` is `ifjump` with one word changed.** Same condition slot,
  same `/0`-refuses-to-decide rule; a yes reports `{visit}` instead of `{jump}`, so
  `nextPc` drops a bookmark. No new machinery in nextPc at all.
- **Its KIND is `'check'`, not its own family.** First attempt gave it kind
  `'ifvisit'` and THREE suites went red: `.block.check` means "a row that asks a
  question" and several suites select conditional rows with it. Coming back is a
  MODIFIER, so it is `.block.check.callrow` — sun like every check, dashed like every
  visit, rope class `cond call`. **Kind = family; modifier = the twist.**
- **A REAL BUG the seed refactor flushed out:** `expectedType` keyed condition slots
  on the parent type, so an `ifvisit`'s condition typed as `'number'` and every
  boolean drop onto it was silently refused. Now keyed on `s.field === 'cond'`. (See
  "key slot types on the FIELD" up top — this lesson has now paid twice.)

### The seed program: the arrow handlers are subroutines (36 → 35 rows)
    ⚑ start
    if ← isKeyPressed visit ⚑ goLeft      (was: jump goLeft)
    if → isKeyPressed visit ⚑ goRight
    move paddle to paddleX, 95             (the `⚑ move` label is GONE)
    ...
    ⚑ goLeft / paddleX = paddleX − 8 / return     (was: goto move)
    ⚑ goRight / paddleX = paddleX + 8 / return

The win is not the row count. `goLeft` used to be a place you jumped INTO and then
had to jump out of to a THIRD place, which needed a `⚑ move` label whose only job was
to be landed on. As subroutines they hand control straight back: **one label and two
gotos deleted, two returns added.** First default program where a flag is a TOOL, not
a place. **Behaviour change, deliberate:** holding BOTH arrows now runs both nudges
(net zero) instead of letting ← silently win by jumping past the → test.
Fall-through after the call is the whole point of a call.

### Why the bounce/brick chain was NOT converted — measured, not guessed
Its **mutual exclusion is load-bearing.** A one-way jump into a handler that ends
`goto start` guarantees at most ONE handler runs per pass. Convert the callers to
`ifvisit` and every MATCHING handler runs, so a ceiling bounce and a brick hit in the
same pass flip `ballVelocityY` **twice** — a net no-op, and the ball sails through the
ceiling. It is reachable, not theoretical: at the top the ball spans y 0..22 and the
bricks 14..30, so an 8px overlap while x also overlaps a brick is an ordinary event.
**Reproduced in a throwaway harness before deciding.** Fixing it properly means making
the handlers idempotent or separating the axes — a physics decision, not a
call-syntax one. The reasoning is also inline above `label('bounceX')` so nobody
re-tries it blind.

## Phase 14 — the backpack is a STACK OF POUCHES — DONE
**Terms:** a **pouch** is one entry in the visit stack, drawn as a card in the
backpack panel. Every `visit` pushes one, every `return` pops one, and `pouches[0]`
is **the world** — pinned, never popped, and its notes ARE `state` (same object
identity), so every direct `state[...]` read in the engine kept working untouched.
A **note** is a variable living in a pouch; the eight game variables were "simply
the world's notes" from here on, and **Phase 20e finished the sentence** — they
are notes the PROGRAM declares, and the world starts empty. The **open pouch** is an always-present staging pouch above the active
one: it has parcels but no label, no notes and no return-ref, and it is deliberately
NOT in the `pouches` array, which makes "invisible to name resolution, exempt from
CALL_MAX" true by construction rather than by filtering.

### The open pouch — Patrick's catch, and the keystone
The first draft gave each frame its own belt. That is a NON-FIX: a callee's pouch does
not exist when the caller `pack`s, so parcels could only land in the caller's own
queue — observationally identical to Phase 13's single global belt, zero isolation
bought. Staging solves it the way real calling conventions do (fill the frame-to-be,
THEN call), and it collapses four verbs into four sentences:

- **`pack e`** → appends to the OPEN pouch. Always.
- **`visit ⚑f`** → the open pouch BECOMES the call's pouch (label + return-ref stamped
  on; the packed parcels are already inside, which IS the argument passing); a fresh
  open pouch stages. An `ifvisit` NO leaves the staged parcels visibly waiting for
  whichever visit fires next.
- **`unpack into v`** → pops the front of the ACTIVE pouch. Always.
- **`return`** → whatever this visit packed and never took anywhere ARE the results:
  appended to the caller's pouch. Its own pouch — unconsumed arguments and all — is
  discarded with the card.

**The conveyor-belt metaphor dissolved entirely**; parcels just live in pouches, and
"pack a pouch, take it on a visit, unpack it when you arrive" is one story.

### Name resolution — one rule, every verb
- **read**: top pouch → down the pile → the world. Missing everywhere sets `lostVar`
  (the `divByZero` idiom exactly), exec refuses, Beep halts confused with pc parked
  on the row.
- **write** (`assign` AND `unpack`, identically): the NEAREST pouch holding that name
  — write-through, never an implicit shadow. Name nowhere → create in the active pouch
  (first write is creation; at top level that is the world, so top-level notes are
  world notes, visible and inspectable).
- **`new note ⟨name⟩`** — the ONLY way to shadow, and a DECLARATION, which is exactly
  why real languages have them. Creates in THIS pouch even when the name lives below,
  seeds 0, no-ops if already declared here, refuses world names.

This replaced an earlier draft that gave `unpack` a private write-into-the-top rule;
Patrick's version is strictly better because the "world names are never shadowable"
EXCEPTION it needed simply evaporates. **When a rule change makes an exception
disappear, take the rule.**

### What this unlocks: factorial, which Phase 13 could not express
    ⚑start / pack 5 / visit factorial / unpack into ballX / goto done
    ⚑factorial / new note n / unpack into n
    if n < 2 jump base
    pack n − 1 / visit factorial / new note sub / unpack into sub
    pack n × sub / return
    ⚑base / pack 1 / return
    ⚑done

Verified 3!/5!/6! = 6/120/720 with a clean unwind (0 pouches, 0 staged).
**Delete either `new note` and it returns 1** — every depth write-throughs onto one
shared `n`. That clobber is a TEST (T17), not a footnote: the stack UI makes it
watchable, so the declaration is the fix a learner reaches for at the exact moment
recursion demands it.

- **Isolation is a provable property** (T18): a callee handed an empty open pouch
  cannot see its caller's leftovers — Phase 13's nastiest failure mode is structurally
  impossible. A callee's own leftovers die with its pouch (T19).
- **The FIFO wrinkle survives in one place only** (T19b): an UNDELIVERED result sitting
  in your own pouch queues ahead of the next call's result. Same count-agreement
  lesson, localized to one visible card.
- **Calling conventions stay honest.** Both sides must agree on count and order.
  Leftovers sit visibly, unpacking too many halts him, packing a result before
  unpacking all arguments interleaves them. All three are visible, none are prevented
  — the failure modes ARE the curriculum.

### UX and engineering
One panel: the backpack IS the stack. Ghost card on top (what you are packing for the
next visit — it answers "I packed it, where did it go?" by being where it went), visit
cards in the middle with their ⚑ title and ↩ return chip, world card pinned at the
bottom with the only LIVE inputs (pouch notes render read-only; shadowed ones struck
through). A **two-state toggle**: *this pouch* (the pile) and *all in reach* (one
merged list, nearest pouch wins, shadowed entries struck through, each row labelled
with its pouch) — dynamic scope in a single glance.
- `pouches` + a separate `open`; `callStack` and `belt` are deleted, as is the
  separate belt panel (`renderPack`/`renderBelt` collapsed into `renderStack`).
- Bookmark gutter tokens read `pouches.slice(1).map(p => p.ret)` — still NODES, not
  indices.
- Reset empties the pile and the parcels AND deletes any note the program invented at
  top level, then restores the world's start values.
- **Gameplay is byte-identical to pre-Phase-14** across idle/left/right runs — the
  point of frame 0 sharing `state`'s identity.

## Phases 15–17 — every sprite is a VALUE, and sprites own their positions — DONE

### Phase 15 — `despawn` takes a SPRITE, not a name
The last place a sprite was still a string baked into a statement. It is a real slot
now: `despawn{sprite:<sprite node>}`, so a pill drags into it, `x of` and it share the
same material, and a sprite can arrive from anywhere a sprite expression can.
- **`expectedType` needed ONE line, keyed on the FIELD:** `s.field === 'sprite'` →
  `'sprite'`, replacing the list of parent types (prop/alive/edge all use that field;
  touch/closing keep their `left`/`right` by parent type).
- `execCommand` EVALUATES the slot (`evalExpr(node.sprite)`) instead of reading a
  field; `cloneStmt` deep-clones it; `isFocusable` grew a despawn case; `focusedHtml`
  renders the slot.
- **A landmine was defused:** Phase 10's `openSpritePop` (repoint despawn's baked
  field) and Phase 12's `openSpriteValuePop` (edit a sprite VALUE) were twin
  same-named-ish choosers — exactly the duplicate-declaration hazard noted above. The
  Phase-10 one is DELETED along with `.sprite-chip`. One name, one meaning.
- **A pre-existing bug found by test noise:** `wireZing` captured the STATEMENT and
  re-read `b.wireEl` inside its 720ms timer; Reset and `__call.load` both null that
  field, so the callback threw. Uncaught in a timer, so no assertion ever failed — it
  showed up only as stray TypeErrors in test output. Fixed by holding the ELEMENT
  rather than a path to it (same for two `nb.el` zap timers). **Test output is now 0
  exceptions across all nine suites — worth keeping that way**, since this class of
  bug is invisible to assertions.

### Phases 16–17 — ONE `move <sprite> to <x>, <y>`, with explicit coordinates
**Phase 16 was a design decision taken without asking, and it was the wrong call to
make unilaterally.** Collapsing `movePaddle`/`moveBall` into `moveTo <sprite>` looked
like the same mechanical fix as despawn, but it QUIETLY KEPT the real problem: the
engine still derived every sprite's position from variable NAMES (`ballX`/`ballY`,
`paddleX` plus a pinned bottom, `brickNX` plus a fixed row). That is this one
example's naming convention baked into the language. Patrick's correction (Phase 17):
**the parameters must be explicit**, because the goal is that anything be expressible.

**The model now:** a sprite OWNS its position (`spritePos`, logical 0..100 for all
five). Variables are just numbers the program manipulates. `move` is the one moment a
variable's value is pushed into a sprite. Nothing in the engine reads a variable by
name to find out where something is — the convention lives in the PROGRAM, which says
`move ball to ballX, ballY`.

- **`{type:'command', name:'move', sprite, x, y}`** — three real slots, and the
  coordinates are ordinary number expressions, so `move ball to brick2X + 4, 20`
  works. `x of` / `y of` read the sprite, so they compose straight back in.
- **`spriteXY` / `ballBox` / `paddleBox` / `brickBox` all collapse into one
  `boxOf(name)`** over the store; `placeBricks` and the old per-name `moveTo` renderer
  are gone, replaced by `drawSprite` / `drawAllSprites`.
- **The paddle's y is a LITERAL in the seed** (`move paddle to paddleX, 95`),
  Patrick's call. It used to be pinned by the renderer, which is exactly why no
  program could ever move the paddle vertically. Cost: it no longer re-pins on resize.
  Gameplay is nonetheless **byte-identical** across idle/left/right runs — 95 vs the
  computed 94.74 changed no collision.
- **A CONSEQUENCE WORTH KNOWING:** typing a variable in the backpack no longer
  teleports its sprite. Positions are the sprite's own and only `move` changes them,
  so the stage catches up the next time that row runs (instantly during Play; visibly
  lagging when paused). That is the honest reading of "the program moves things" and
  it is the price of any-variable-drives-any-sprite.
- The fresh shelf statement is an **identity**: `move ball to x of ball, y of ball`
  changes nothing until tuned — the always-valid invariant honoured with pieces that
  already existed.
- `collectDivZero` / `stmtOfNode` walk `b.x` / `b.y`, so a `/0` in a coordinate
  refuses the move and parks Beep exactly as it does in an assign.
- **The geometry tests had to be rewritten:** they used to set `state.ballX` and read
  `x of ball`, which SILENTLY encoded the old coupling. **T13e is the new keystone —
  setting a variable does not move the sprite; the `move` row does.**

## Verification pattern
- Extract `<script>`, run `node --check`.
- **`fp3.js <file>` is the gameplay regression harness** and the reason Phases
  17 and 20 could claim "byte-identical" honestly. It plays the seed headlessly
  in three input modes (idle / left / right) and hashes the SEQUENCE of distinct
  (ball position, velocity, paddleX, which bricks are alive) states, so it is
  insensitive to how many statements the program takes to get there — which
  matters, because Phase 20d added fifteen setup rows and a per-step sample
  would have shown 335 spurious differences. Run it against the previous
  `beep.html` (`git show HEAD:beep.html > old.html`) and diff. **Stub the stage
  size**: jsdom reports `clientHeight` 0, and every derived position is then
  nonsense-but-stable, which hides real geometry changes.
- jsdom harness: polyfill `setPointerCapture`/`releasePointerCapture` (no-op),
  `elementsFromPoint=()=>[]`, force `requestAnimationFrame=cb=>setTimeout(cb,0)`.
  Drive the REAL handlers via dispatched pointer/mouse events; assert structure.
- **Gotchas:** async tests must flush `setTimeout(0)` between actions (`suppressClick`
  resets on a 0ms timer). Distinct drop zones need stubbed non-zero
  `getBoundingClientRect`. The editable view renders nested bins as `.group` boxes (no
  parens/spaces); only the compact view (`htmlExpr`) adds `( )` and spaces — assert
  structure, not punctuation. Post-Reset tests must RE-QUERY block elements (Reset
  rebuilds them all). Deleting a wired flag needs a ~2s wait for the nemesis.
- **Edits applied via a bash Python patch script** (exact-match replace, assert
  count==1), because the file-tools sometimes can't overwrite the mounted file on
  Windows.
- **If `require('jsdom')` hangs** (the mounted `node_modules` can wedge over the
  Windows mount): `npm install jsdom` into a sandbox-local dir (e.g. `/tmp/env`), copy
  `beep.html` + `test-*.js` there and run from there. `node --check` and the Python
  patch scripts still work against the mounted copy — only the jsdom load needs the
  local install.
- **Mutation-test every phase.** Seed the bug you think the design prevents and
  confirm a test goes red. Several designs in this doc are documented as
  "mutation-proven" and that is the only reason they are trustworthy: the
  bookmarks-are-nodes rule, LIFO nesting, the `/0` guards, the `expectedType` field
  keying, and both rejected Phase-14 designs.

### Suite status — all ten green, **839 asserts**
| suite | asserts | covers |
|---|---|---|
| `test-phase8.js` | 30 | palette, mint-on-drag, replace/wrap, shelf counts |
| `test-phase9.js` | 76 | statements as material, panels, help discs, nemesis, chips |
| `test-drop.js` | 33 | `DROP_TABLE` totality + the `accepts` gate, exhaustively |
| `test-grammar.js` | 36 | `×`/`÷` and the op registry |
| `test-diverror.js` | 18 | divide-by-zero, both surfaces, incl. `move` coordinates |
| `test-compare.js` | 81 | comparisons: eval, flip-is-negation, drop, refusals |
| `test-bool.js` | 84 | and/or/not, in===out, De Morgan, identity-is-a-no-op |
| `test-sprite.js` | 239 | Phases 12, 15–17 and **20**, incl. the per-axis `isClosingOn` regressions |
| `test-call.js` | 130 | Phases 13/13b/14: staging, resolution matrix, factorial, every halt |
| `test-notes.js` | 112 | Phase 18: typed notes, sprite vars, `'any'` slots, typed parcels; Phase 19's `empty`; **Phase 20e's "no world variables"** |

`test-call.js` was REWRITTEN at Phase 14 (the Phase-13 pack/unpack tests are gone by
design, not preserved).

## Phase 18 — sprites go everywhere numbers go — 18a–18c DONE, 18d deferred
**The goal:** a sprite can sit anywhere a number can — in a note, in an assign, in
a parcel — so `pack brick1 / visit hitBrick / unpack into b / despawn b` is a
program a learner can build. This absorbs the doc's single remaining blocker
(sprite-valued parcels) and two planned items (typed notes, palette tiles for
notes) into one design.

**Shipped:** the capability (18a–18c). **The seed program is untouched** and
plays byte-identically — 18d, the hitBrick refactor, is still planned below.

### What the build changed about the plan
Three things only implementation could settle:
- **Parcels are NOT tagged `{type, value}`.** The plan called for it; it is dead
  weight. A sprite VALUE is its name, so `valueType(x)` recovers the type from
  the value itself, and sprite names are the language's only strings. A parcel
  stays a bare value, which also keeps a pouch a plain list a learner can read.
- **Retyping a seed is a quiet REFUSAL, not a confirm dialog.** The plan's
  primary was the label-deletion treatment (confirm, then fray the holders); the
  fallback was a refusal. The fallback is better and it is one line: the seed
  slot is `'any'` only while nothing reads the name, and pins to its current type
  once something does. No dialog, no fraying, and it matches how a required slot
  already refuses removal — the slot simply stops lighting up.
- **A var with no declaration answers `'number'`, not a broken type.** Modelling
  brokenness in the type system would have changed what every var answered before
  this phase. Instead `varLost(name)` drives the frayed rendering and `readVar`
  already halts Beep at run time — brokenness is SHOWN, not typed. The tradeoff:
  a sprite var orphaned by a deleted declaration types as a number until the
  reference is repaired. It is an already-broken program and it halts on the row.

### A real bug the phase surfaced
`execUnpack` shifted the parcel off the queue BEFORE writing it. With a type
check in the write, a refused unpack ate the parcel: the next step reported "my
pouch is empty" instead of the type clash, and the parcel a learner was about to
rescue was already gone. Every other refusal in the language leaves the world as
it found it — a `/0` refuses the write, a missing name refuses the read, and pc
parks so the row can be fixed and re-stepped. Now it peeks, type-checks, and only
then consumes. **M4 in the mutation set is that regression.**

### Most of it already exists — the plan is mostly refusing to build things
The runtime is nearly done: **`evalExpr` already says "a sprite VALUE is its
name"** (`case 'sprite': return e.name`), every sprite slot already evaluates its
contents (`despawn`/`move`/`x of`/`is alive`/`touch`/`closing`/`edge` all call
`evalExpr` on the slot), and `readVar`/`writeVar` move values without caring what
they are. Put the name string `'brick1'` in a note today and `despawn ⟨that var⟩`
would very nearly work. What is actually missing is exactly three things: an
answer for `typeOf(var)` other than the hardcoded `'number'`, a way for a note to
BE sprite-typed, and a type tag on parcels. Everything else — the drag gate, the
pill silhouette, the replace verb, the choosers — serves sprites already and just
needs the type system to route through it.

### The one rule everything hangs on: a note never changes type
`typeOf` must answer at AUTHORING time (the drop gate runs on hover), so a var
node needs a type before the program runs. The rule: **a note's type is fixed at
creation, and one name has one type across the whole program** — the same shape
as "names remain the identity" for flags, and it makes both layers cheap:
- **Authoring:** `typeOf(var)` = look the name up — in `VARS` → number; else find
  the program's `new note` declaration and take the type of its SEED. One source
  of truth, no type stamps on nodes. Deleting the declaration out from under
  var nodes is the Phase-9 amendment yet again (fourth instance): the pills
  render frayed like a lost flagref, and at run time `readVar` already halts
  Beep via `lostVar`. Nothing new to build for the failure case.
- **Runtime:** ONE check in `writeVar` — refuse a value whose type differs from
  the note's current value's type, halt confused ("a sprite in a number
  pocket?!" — a new `STUCK` door). Because `assign` and `unpack` both write
  through `writeVar`, both are covered by the same line — the Phase-14 "one
  rule, every verb" idiom exactly. World variables are numbers, so
  `unpack into paddleX` with a sprite parcel halts visibly instead of breaking
  the paddle.

### Where a sprite note comes from: the declaration grows a SEED SLOT
`new note n` currently seeds 0 with no slot. It becomes **`new note n = ⟨0⟩`** —
one ordinary expression slot, which buys three things at once:
- **The slot IS the type declaration.** Drop a sprite pill in and the note is
  sprite-typed; drop a yes/no in and booleans ride along for free. No new
  keyword, no type dropdown — choosing the seed is choosing the type, visible
  right on the row.
- It is the language's ONLY polymorphic slot (`expectedType` → `'any'`, a new
  value the gate honours; every other slot stays exactly as typed as it is).
- `pack`'s slot becomes `'any'` the same way — that is the whole "pack a sprite"
  feature. The shelf proto still seeds `0`.
Retyping a seed while the name is in use elsewhere would silently ill-type every
var node holding that name, so: **retype = the label-deletion treatment.**
Confirm dialog with the holders highlighted; confirmed → those vars fray. (The
cheaper alternative — refuse the edit outright while holders exist — is the
fallback if the fray path fights back; a required-slot-style quiet refusal is
one line.)

### The UI is already built — reuse, verbatim
This is the deliberate centre of the design: **the gesture a learner already
knows from `move`/`despawn` IS the whole interface.** A sprite slot takes a
dragged pill; a sprite variable is just one more pill to drag.
- **Palette:** a declared sprite note gets a tile automatically — same scan that
  fills `openLhsPop`'s list (`program` for `note` rows), same "new variable ⇒
  tile appears" promise Phase 8 made. It renders as a coral PILL in var styling:
  silhouette says sprite, styling says variable. Minting it makes an ordinary
  `v(name)` node; `typeOf` routes it to sprite slots and nowhere else. **No new
  payload, no new target, no new DROP_TABLE row** — the drop model's fourth
  free ride.
- **assign:** the LHS `tgt-chip` chooser gains nothing new — it already lists
  declared notes. Picking a target of a DIFFERENT type replaces the RHS with the
  new target's identity read (`s = s`), and the displaced RHS retreats to the
  spare tiles — the same "behaviour unchanged until tuned + material never lost"
  pair every other edit honours. No new shelf proto: sprite assigns are reached
  by retargeting the one assign that exists.
- **unpack:** the same chooser via the same chip; the runtime `writeVar` check
  does the rest.
- **Backpack:** a sprite note's card shows the pill of its current value
  (read-only, struck through when shadowed, like every pouch note). ~~Only world
  notes have live inputs, and world notes are all numbers, so `VAR_META` and the
  number widget never meet a sprite.~~ **That premise died in Phase 20d** — the
  seed declares its sprites at TOP LEVEL, so they land in the world pouch. The
  live-input decision is keyed on what a note HOLDS now, not on which pouch it
  is in, which is the shape it should always have had. (`VAR_META` itself went
  in 20e — every note's spinner is the same generic range.)
- **Bubbles and parcels:** `bubbleExpr` substitutes the name into the thought
  bubble; a parcel renders as a mini pill. Parcels become tagged
  (`{type, value}`) rather than raw — `parcelStrip` needs the tag anyway to
  draw the silhouette, and the doc predicted this shape in Phase 13.

### The payoff program — with the Phase-13b hazard confronted, not repeated
The three brick handlers become one routine. But two measured facts from 13b
still bind: converting the callers to bare `ifvisit`s breaks the mutual
exclusion that stops a double bounce, AND a `pack` before an `ifvisit` that says
NO leaves the argument staged — poisoning the next visit's parcels (T19b's
wrinkle made fatal). The shape that avoids both is jump-guarded packing:

    if not (ball isTouching brick1) jump skip1
    pack brick1 / visit hitBrick
    ⚑ skip1  ... (same for 2, 3)

    ⚑ hitBrick / new note b = ⟨ball⟩ / unpack into b
    despawn b / ballVelocityY = 0 − ballVelocityY / return

`pack` only runs when the visit WILL fire, and a hit can `jump done` past the
remaining checks to keep at-most-one-per-pass. Costs `not` and a label per
brick; buys one handler instead of three and the first seed use of notes AND
parcels. **Prototype it in a throwaway harness before committing the seed**
(the 13b rule) — the double-hit case to reproduce is the ball spanning two
adjacent bricks in one pass.

### Deliberately NOT in this phase
- **Sprite equality** (`⟨s⟩ is ⟨brick1⟩` → boolean) — the natural "which brick
  did I catch?" test. It is a fourth two-sprite bridge and would ship through
  the same `cmp`-style delivery route in an afternoon, but nothing in the
  payoff program needs it. Listed, not built.
- **Sprite-typed world variables** — the world's eight numbers are load-bearing
  game state; nothing needs a world sprite.
- **`ifvisit` argument staging** (a NO discarding staged parcels) — 13b decided
  leaving them visible is the curriculum; the jump-guarded shape above respects
  that decision instead of reopening it.

### What landed, by stage
- **18a — types (DONE).** `note_(name, seed)` with an `expr` field, so
  `scanDivZero` / `stmtOfNode` / `collectDivZero` picked it up for free (they
  already walk any statement's `.expr` — the same gift `pack` got). `noteType` /
  `noteDecl` / `noteHolders`; `typeOf(var)` routes through `noteType`;
  `fits(valType, slotType)` and an `'any'` slot type; `compatible` rewritten to
  ask whether each node fits the OTHER slot (the old "both slots expect the same
  type" shortcut was equivalent only while every slot was monomorphic); the
  `writeVar` type check with `badTypeMsg`; `execNote` evaluates its seed and
  refuses on `/0` or a missing name exactly as `execPack` does.
- **18b — the UI (DONE).** Note tiles are **not PALETTE entries** — they carry
  `data-note` and are synthesised on pointerdown by `paletteItem`, so no index
  can shift under the static prototypes on a shelf that is built once.
  `refreshNoteTiles` runs from BOTH `renderSlots` (a seed edit can change a
  note's TYPE) and `drawWires` (a declaration can come or go with a structural
  edit) — two hooks because they are two different edits, the second being the
  hook `renderMarks` already rides. `varChip`/`varLost` fray an orphaned var;
  the editable var token wears the coral pill when its note holds a sprite;
  `noteVal` gives pouch cards and parcels their sprite pills; `retarget` swaps
  in the new target's identity read on a cross-type LHS change and sends the
  displaced expression to the spares.
- **18c — parcels (DONE).** `pack`'s slot is `'any'`; parcels render their
  silhouette through `noteVal`; `unpack` rides the 18a check. No tagging — see
  above.
- **18d — the seed payoff (NOT DONE, still planned).** The harness-first rule
  and the jump-guarded shape above stand unchanged.

### Verification
`test-notes.js` — **71 asserts**, `10/10 mutants caught`: `typeOf(var)`
hardcoded to number; the `writeVar` check removed; `unpack` not honouring the
refusal (the one-rule-every-verb claim, broken on one door only); a refused
unpack eating the parcel; a seed slot that never pins; `execNote` ignoring the
seed; a cross-type retarget keeping the old RHS; a seed that is not deep-cloned;
note tiles that never refresh; `pack` typed number-only.

**Two of those mutants were MISSED by the first draft of the suite, and both
lessons generalise.** The shared-seed mutant survived because the test edited the
seed by DRAGGING a new pill in — a drag REPLACES the node reference on one
statement, so a shared node never shows. Only an in-place edit (tap the pill,
pick another sprite) mutates the node itself, which is exactly the gesture Phase
15's T13b used. It then survived a second time because the test read the other
row's STALE DOM: an unfocused row is not re-rendered, so it has to be focused to
be read from its own AST. **Assert on the tree, or on a surface you have just
forced to re-render — never on DOM that nothing asked to update.**

All ten suites green: **640 asserts**, 0 stray exceptions. The seed program's
gameplay fingerprint and all 80 chooser popovers are unchanged; the only DOM
difference anywhere is the note shelf tile now reading `new note note = 0` and
an empty, hidden `notes` palette group.

## Open threads / next
## Phase 19 — `empty the pouch I am packing` — DONE
The only way to DISCARD staged parcels from inside the language. Until now a
program that staged parcels and never took them anywhere had **no way back**:
Phase 14 deliberately leaves them visible, but nothing short of Reset could
clear them, so the pile was a failure a learner could watch and not fix. That
hole is the reason to add the verb, independent of conditional calls.

- **It empties the OPEN pouch only** — the one being packed. The active pouch is
  off limits on purpose: those are the arguments this visit was handed, and
  anything left in them already dies with the pouch on `return` (Phase 14, T19),
  so the staging pouch is the only place junk can outlive the moment that made
  it. `test-notes.js` T13c is that boundary; a mutant that empties the active
  pouch instead reddens nine asserts.
- **Slotless, like `return`** — kind `pack`, so it wears the teal that says "acts
  on the pouch being packed" and inherited the family colour with no new CSS.
- **Bubbles what it did** (`tipped out 2 parcels`), and on an already-bare pouch
  it SAYS so rather than pretending to work — a visible no-op, not a silent one.

### What it does and does not buy for conditional calls
Placed after an `ifvisit` it is **exactly a no-op on the yes path and exactly the
cleanup on the no path** — the mechanism being that `return` delivers results
into the CALLER's active pouch, never the staging one, so a completed call always
leaves a fresh staging pouch behind. T13d asserts both halves.

But it is **caller cleanup, not a fix**: forgetting the row reproduces the
original bug in full (T13e watches a stale argument poison the next visit), so
the safety rests on a convention, and this language's whole ethos is making
failure visible rather than trusting convention. There is also an asymmetry
worth knowing: under `pack X / if C visit f / empty`, X is still EVALUATED on the
no path, so a `/0` inside it halts Beep on a row that was never going to matter.
Under the jump-guarded shape the pack never runs at all. **Jump-guarding remains
the taught idiom for conditional calls; `empty` is the repair verb.**

**The deeper reading, recorded so it is not rediscovered:** the awkwardness is
not in the pouch model. It is that conditionality in Beep attaches to SINGLE
STATEMENTS — there are no blocks, so any two-statement action that must happen
atomically under a condition needs a guard jump, and pack-then-visit is only the
case where the leftover is persistent, visible state. If that friction ever stops
being worth its teaching value, the graduated answer is call-site arguments as
sugar (`if C visit f with ⟨expr⟩`, evaluated only when the call fires, atomic by
construction) — which would not replace pack/unpack, since results still ride the
pouch home. That is a phase-sized decision, not a patch. **Auto-discarding staged
parcels on a NO was considered and rejected:** it gives a failed condition a side
effect on state it never touched, which is worse magic than the problem.

## Phase 20 — sprite CLASSES and INSTANCES — DONE (20a/20b/20c)
The first half of `PLAN-sprites-events.md`. Five hardcoded sprites become
**three classes and five instances**, and the language gains the two pieces the
event runtime will need: a way to MAKE a sprite and a way to PUT IT ON the
stage. The event engine (Phases 21–24) is untouched by this phase — deliberately,
so the risk concentrates later.

### The split, and why it is the whole phase
A sprite used to be a NAME with a stylesheet rule and a hardcoded size. It is
two things now:

- a **CLASS** — `{name, w, h, style}` in `classes`. `style` holds exactly the
  editor's options as CSS declarations. Three of them (`Ball`, `Paddle`,
  `Brick`) replace five hand-written stylesheet rules.
- an **INSTANCE** — `{id, cls, x, y, onScene, el}` in `instances`. Five of them
  keep the LEGACY ids (`ball`, `paddle`, `brick1..3`), which is why every
  `sprite{name}` in the seed program still names something real and **all ten
  suites stayed green through 20a with no edits at all**.

`SPRITES`, `SPRITE_SIZE`, `spritePos` and `spriteAlive` all dissolve into
`instances`. `boxOf(id)` (instance position + class size) is still the ONE
geometry function. **Gameplay is byte-identical** — the fingerprint harness
(`fingerprint.js`, 360 samples across idle/left/right) hashes the same before
and after.

**`spriteAlive` and `spritePos` survive as Proxy VIEWS over `instances`**, kept
only so `__lang` and the suites read the way they always did while the store
underneath moved. They are live views, not copies, so there is still exactly one
source of truth. **Phase 24 deletes both with the legacy names.**

### A class is NOT a value type
The only thing code can do with a class is instantiate it, so it rides as a
**chip** on `a new ⟨Class⟩` — the EDGES precedent (finite, chosen, never
computed, never stored, never the result of anything). `LEAF_CHOICES.new` is one
entry; `openChoicePop` is still the only body. If classes ever need to flow
through expressions, that is the upgrade point.

### `a new ⟨Class⟩` — the language's ONE effectful expression
A deliberate amendment to "expressions stay pure", and the rule that makes it
safe is **instantiation happens exactly once per execution**:

- `execStmt` opens a memo (`mintMemo`, a `Map` keyed by NODE) and closes it in a
  `finally`, so "exactly once" is a property of the interpreter rather than a
  discipline every caller keeps.
- Inside a live step, the FIRST evaluation mints and everyone after reads the
  memo. This matters concretely: `execAssign`/`execPack` call `bubbleExpr`
  BEFORE `evalExpr`, so the row asks the node twice — with the memo the parcel
  IS what the bubble named, without it there are two instances and the parcel is
  the second one.
- **Outside a live step — bubble redraws, authoring scans, chooser previews —
  nothing is ever created**; `evalExpr` renders the phrase `a new Ball`
  symbolically. Two mutants cover this (M2, M3) and both go red loudly.

What it buys: **the declaration machinery needed ZERO changes.**
`new note ball = ⟨a new Ball⟩` types the note from its seed exactly as Phase 18
built it, and the sprite-note chicken-and-egg (no sprite value existed to seed
with) dissolves, because this expression IS a source of sprite values. Assign
and pack came free the same way.

Ids are minted **per class** with a reserved spelling (`Brick·1`, `Brick·2`), so
a sprite value can never be typed by hand into collision with a class name, a
flag or a legacy id.

### `add ⟨sprite⟩ to the scene` — membership is a statement
One ordinary sprite slot and nothing else: `s.field === 'sprite'` already types
it (the Phase-15 lesson paying off a third time), so the statement needed **no
new machinery anywhere**. On-scene means rendered and visible to the sensors; an
instance minted by `a new ...` starts OFF the scene — it exists as a value
(movable, storable, packable) but has no DIV and is not overlap-scanned.

**`despawn` is reframed as the exact inverse.** Observably nothing changed —
hidden, touches nothing, references held in notes stay safe — but `add` can now
bring the same instance back. Adding one that is already there is a visible
no-op bubble (the `empty` idiom: say so rather than pretend to work).

**Reset REBUILDS the scene**, which is how instances the program minted are
destroyed. No separate bookkeeping for "the ones we made" — respawning the seed
IS the reset. **Classes are not reset material**: they are the workbench, like
the palette.

### DROP_TABLE: zero new rows — the FIFTH free ride
`a new ⟨Class⟩` is an ordinary `proto-value` (→ `replace`); `add ... to the
scene` an ordinary `stmt-proto` (→ `insert`). No new payload, no new target, no
new row. (T20u asserts it.)

### The class panel (20b)
A class has no source-code form — there is no `class Ball { … }` row — so **its
editor IS its representation**. One card per class; the card's swatch is a live
DIV wearing the class's own declarations, so it is not a picture OF the class
but an instance of it, standing still.

- **`CLASS_OPTS` is the one registry**: background-color, background-image,
  border-color, and four NUMERIC options — border-width, border-radius, plus
  **width and height** (`size:true`, they live on the class root rather than in
  the style block). It drives the card, the popover AND the order the
  declarations are written in — adding an appearance option is one entry, and
  `openClassPop`'s body never learns its name. Every numeric option is edited by
  `numRow`, the same control a number literal gets; `unit` is what lets the
  editor deal in plain numbers while the class still holds ordinary CSS
  (`3` → `3px`). **`border-style` was dropped** — a sprite's edge is always
  solid and the shared `.sprite` rule supplies it, so the class no longer says.
- **A Ball is round by a NUMBER now** (`border-radius: 14px`, half its 28px
  border box) rather than by `border-radius: 50%`. A percentage is not something
  a number editor can write, and the trade was taken deliberately: resize the
  class and you set the corners too, but the rule that makes a Ball round is a
  value you can see and change, like every other rule here. This is a knowing
  deviation from the plan's "`border-radius: 50%` is how a Ball is round".
- **`setClassOpt` is the single door**: write, `restyleClass` (every live
  instance repainted, position preserved — M1), `renderClasses`. **One source of
  truth for a look** is the whole reason classes exist, so the mutant that skips
  the restyle is the load-bearing one.
- **"+ new class" mints an always-valid default** — grey 20×20 `class1` with
  every declaration filled in. There is no half-made class.
- **Rename is a refactor** (`renameClass`): live instances, `a new ⟨Class⟩`
  chips and the panel order all follow, exactly as `renameLabel` does for flags.
  **`nameTaken` is ONE namespace check** — class, flag, world variable, declared
  note — because all four are things a learner names.
- **Delete gets the label-deletion treatment**: holders highlighted (the ROWS,
  via `rowsHolding`, since a chip only renders in the focused statement),
  confirm, then those chips **fray** — the FIFTH instance of the Phase-9
  amendment. `htmlExpr` frays too (`clsChip`), because a broken program has to
  look broken in the compact view as well as the editable one. Running the
  frayed row halts Beep on it ("a class called Wall? I do not have one!").

### Deliberate visual change, recorded
The paddle's `.3s ease-out` and the ball's `.5s linear` become **one shared
glide** on `.sprite`: how a sprite animates is not one of the class editor's
options, and Phase 22d's rAF interpolation replaces CSS transitions anyway. The
ball's white highlight (a `::after` pseudo-element a class cannot own) came back
as a `background-image` radial-gradient — which IS one of the editor's options,
so the shine is now something a learner could make or remove themselves.

### 20d — the seed program builds its own world (Patrick's call)
20a–20c deliberately kept the five legacy instances so nothing had to move at
once. **20d spends that budget**: the stage starts EMPTY and the seed program is
where every sprite comes from. Fifteen rows above `⚑ start`, three verbs per
sprite:

    new note brick1 = ⟨a new Brick⟩      MAKE one   (an expression, so it fits a note)
    move brick1 to brick1X, 6.3636       PUT IT somewhere
    add brick1 to the scene              PUT IT ON the stage
    …brick2, brick3, ball, paddle (paint order)
    ⚑ start                              …and the game loop starts here

**Why above the flag:** `goto start` at the bottom lands on the LABEL, so the
setup runs exactly once per run with no guard row anywhere. Under the event
runtime (Phase 22) this becomes the scene's `start` handler and the placement
stops being a trick. A mutant that puts a flag above the preamble (so the loop
re-enters it) reddens the suite.

Four things fell out, and each one closed something the doc had listed as owed:

- **`spriteVel` — the last convention-bound read — is gone.** It reached for
  `state.ballVelocityX/Y` BY NAME, which only ever worked for a sprite called
  `ball`; once the program mints `Ball·1` there is no such sprite. Velocity is
  DERIVED now: `moveSprite` records how far the last move carried each sprite.
  Convention-free, works for anything moved by any means, and it finally makes
  the paddle read as moving (it genuinely does; it used to report `{0,0}` and
  count as a rest contact). **The trajectory is unchanged** — measured, not
  assumed: `fp3.js` hashes the sequence of (ball, velocity, paddle, bricks)
  states across idle/left/right and the two builds agree state for state, the
  only difference being three extra states per run where the bricks appear one
  at a time during setup.
- **The five static sprite pills retired**, and their replacement cost nothing
  because it was already built: the seed declares `new note ball = ⟨a new
  Ball⟩`, so `refreshNoteTiles` puts a `ball` pill on the shelf by itself. Same
  label, same coral silhouette, dashed because it STANDS FOR a sprite rather
  than naming one. Phase 8's promise keeping itself, for sprites the program
  invents. `SPRITES` is deleted; `sceneNames()` asks the registry instead.
- **A REAL BUG this surfaced.** `LEAF_CHOICES.var` offered the world's eight
  regardless of slot, which was safe only while a var could never sit in a
  sprite slot. The seed's sprites are notes now, so sprite slots routinely hold
  vars — and offering `ballX` there would silently ill-type the slot with no
  drop gate anywhere to catch it (the chooser writes a field; it does not route
  through `accepts`). It is type-filtered now: every name whose `noteType` FITS
  this slot, world variables and declared notes alike. M13 is that regression.
  **The lesson is the Phase-13b/15 one for the third time: a chooser is a drop
  path that skips the gate, so it needs the type rule spelled out.**
- **A BUG THIS SHIPPED, and the shape of it is worth keeping.** Phase 18 wrote
  down the premise "only world notes have live inputs, and world notes are all
  numbers, so the number widget never meets a sprite". 20d falsified the second
  half without touching the backpack at all — top-level `new note ball = ⟨a new
  Ball⟩` lands in the world pouch — and the world card started offering a number
  spinner for a note holding `Ball·1`. It looked cosmetic and was not:
  `commitVar` writes straight into `state` and is the ONE writer that skips
  `writeVar`, so the spinner was a door into putting a number in a sprite pocket
  past the exact check that exists to refuse it. Fixed by keying the decision on
  what a note HOLDS rather than which pouch it sits in (plus a refusal in
  `commitVar` for a stale input), and the "all in reach" view now renders values
  through `noteVal` too, so a sprite reads as a pill everywhere.
  **The generalisable bit: a documented premise is a liability, not a guarantee.
  This one was written down, correct when written, and quietly falsified from
  three sections away.** When a phase changes where values LIVE, re-read every
  claim of the form "X is always a number".
- **The brick row's y is a program literal** (`6.3636`) instead of a pixel
  constant the engine converted. Same trade Phase 17 made for the paddle's 95,
  and it is why a brick can now be moved vertically at all. Decimals are
  perfectly good literals.

**The cost, honestly:** the opening frame is blank until you press Play or Step.
That is the honest reading of "the program makes the world" and it was Patrick's
call with the alternatives on the table (a pre-built frame would mean two
sources of truth for the scene, which is the thing Phase 20 just removed).

**Test migration — the cost the plan predicted, paid early.** 141 legacy-name
references across three suites. The pattern that made it cheap: each suite binds
the sprites the way the PROGRAM does. `test-sprite.js` has `boot()`, which steps
the preamble and reads the notes it declared (and must be called again after
every Reset, because Reset now empties the scene); `test-notes.js` mints its own
with `remint()`, because those tests are about the type system and not about
where a sprite came from. No test-only backdoor was added to the engine — both
helpers use seams that already existed.

### 20e — there are no world variables (Patrick's call)
The last thing in this language that existed because the ENGINE said so. Eight
numbers were born with the page, spelled out in a `START` table, listed in
`VARS`, given private spinner ranges in `VAR_META`, and protected by name from
being shadowed or redeclared. They are ordinary notes now, declared by
`new note paddleX = 40` rows at the top of the seed exactly as a learner
declares their own.

**The backpack starts empty, for the same reason the stage does.** `pouches[0]`
is still the world and `state` is still its notes by identity — but nothing is
in it until the program's own rows run, and Reset clears it completely. One
bargain, both halves of the world.

**What this DELETES is the point**, and it is all exception-shaped:
- the world-name refusals in `execNote` and `validNoteName` — there is nothing
  left to protect, so `new note paddleX` inside a visit now SHADOWS like any
  other name. Phase 14's own rule ("`new note` is the only way to shadow") loses
  its last carve-out. Phase 14 wrote down the principle for exactly this case:
  **when a rule change makes an exception disappear, take the rule.**
- the `VARS`-first branch in `noteType` — a name's type is its declaration's
  seed, always, with no list answering ahead of it. A mutant that hardcodes
  "these names are numbers" is caught by declaring `paddleX` as a SPRITE.
- the eight static palette tiles — `refreshNoteTiles` grows them from the
  declarations instead, so they follow a rename and vanish with a deletion the
  way nothing static could.
- `VAR_META` — every note's spinner is the same generic range whatever it is
  called, so renaming one cannot silently change what you may type into it.
  `metaOf` is what is left: one range, no names. **This resolves the doc's
  "two unrelated notions of range" thread by deletion rather than by design** —
  the per-statement `clamp` field is now the only range the system has, and
  whether the language wants BOUNDED VARIABLES is still an open question, just a
  cleaner one.

**Gameplay is unchanged** — 1606 of 1606 shared trajectory states, the only
difference being two extra samples per run while the declarations execute one at
a time (the same way the bricks appear one at a time in 20d).

**The seed preamble is 23 rows**: eight numbers, then five sprites at three rows
each. The numbers come first because the `move` rows read them. That is a long
opening, and it is the honest price of a program that hides nothing.

**Verification (20e).** `test-notes.js` grew to **112 asserts** with T14–T14d.
The five new mutants: `clearRunMemory` sparing a name ·
`noteType` hardcoding a world list · `execNote` refusing a name · the static
variable tiles returning · `metaOf` getting its private ranges back.

**Two of the five were MISSED by the first draft, both for the same reason: the
test could not tell the mutant from the truth.** The Reset test clicked Reset
while the backpack happened to be empty, so "spares one name" spared nothing —
fixed by running the program's declarations FIRST, then resetting. And
`noteType('paddleX') === 'number'` passes whether the answer came from the
declaration or from a hardcoded list, because the honest answer and the cheat
agree — fixed by declaring `paddleX` as a sprite, where they disagree.
**A mutant only dies where the right answer and the wrong one differ; assert
there.**

### Verification — the whole of Phase 20
`test-sprite.js` grew from 94 to **239 asserts** (T20a–T20u); across the suites
the phase is **24/24 mutants caught**: class edit not restyling live instances · a loose evaluation minting a
phantom · no memo (one execution minting twice) · a fresh instance on the scene
at once · an off-scene instance overlap-scanned · re-`add` building a second DIV
· Reset leaking the scene · class delete bypassing the confirm · rename not
reaching the holders · `add`'s sprite slot not deep-cloned · the setup re-running
on every loop · velocity not derived from the move · the untyped variable chooser
· a numeric class option dropping its unit · a live numeric edit rebuilding the
panel instead of repainting the card · the backpack drawing a number spinner for
a sprite note · `commitVar` clobbering one from a stale input · a statement
materializing on contact · the block-drag listeners back on `blocksBox` ·
`clearRunMemory` sparing a name · `noteType` hardcoding a world list ·
`execNote` refusing a name · the static variable tiles returning · `metaOf`
getting its private ranges back.

**M15 was MISSED by its first assertion and the miss generalises.** The test
checked that the chooser survived a keystroke — but the popover lives in
`document.body`, so rebuilding the panel never touched it and the mutant walked
straight through. The property that is actually load-bearing is element
IDENTITY: a live edit REPAINTS the existing swatch, so the card the chooser is
anchored to is still the same node. **Assert the thing the design actually
guarantees, not a symptom you would expect to see downstream of it.** The last one was
MISSED by the first draft — there is no `add` row in the seed, so Reset never
exercises its clone; the test that catches it duplicates the row through the
grip menu and edits the copy IN PLACE (a drag would replace the reference and
hide the sharing — the Phase-18 lesson, third time). 20d added three more:
the setup re-running on every loop, velocity not derived from the move (which
blinds `isClosingOn` silently), and the untyped variable chooser above.

**Next: Phase 21 (contexts), then 22 (the event engine).** See
`PLAN-sprites-events.md`. Nothing in 20 forced a design revision, and 20d has
already done three pieces of Phase 24's list: the seed's instantiation half, the
retirement of the static pills and legacy names, and the `spriteVel` fix. What
is left for 24 is the EVENT half — walls as sprites, per-class scripts, the
overlap vector — which needs 21–23 first.

**Next up:**
- **Phase 21 — contexts** (`PLAN-sprites-events.md`). Factor
  `program`/`pc`/`pouches`/`open` into a context object with a module-level
  `cur`; the scene gets one, every instance gets one. Pure refactor, all suites
  stay green.
- **18d is SUPERSEDED**, not dropped: the three brick handlers still collapse
  into one, but into `Brick`'s own script in the Phase-24 seed rewrite rather
  than into a `hitBrick` routine. The jump-guarded shape and its two hazards
  stay recorded in Phase 18 because they are still the taught idiom for a
  conditional call.

**Known limits worth fixing:**
- **A class rename does not migrate instance ids.** `Brick·1` keeps its
  spelling after `Brick` becomes `Wall`. Ids are opaque values and nothing reads
  the prefix, so this is cosmetic — but it is the one place where the "names
  remain the identity" refactor stops short.
- **A returning user's saved panel order puts Classes last.** `initPanels` only
  honours keys that still resolve and appends the rest, which is the documented
  behaviour for panels added since the save. No migration needed.
- ~~`spriteVel` is the LAST convention-bound thing left.~~ **FIXED in Phase
  20d** — velocity is derived from the last `move`'s delta, which is the fix
  this entry prescribed. Nothing in the engine reads a variable by name any more.
- **A sprite's velocity is its last MOVE, not its last tick.** Two moves in one
  pass and only the second counts; a sprite nothing moved reads `{0,0}` and
  counts as a rest contact. Under the fixed timestep (Phase 22) this becomes
  per-tick and the wrinkle goes away.
- **The sticky side column is coupled to the program's height.** `.side` is
  `position:sticky; top:12px`, and a sticky box may not leave its containing
  block — here the grid AREA, whose height is the taller column, i.e. the
  program. Scroll far enough that the column clamps against that bottom edge and
  any change to the program's height shifts the whole right-hand column. Adding
  a row is the obvious trigger; deleting one and folding a panel do it too. The
  tap bug made it fire on a mere click, which is fixed, but the coupling is
  still there on a genuine drop. Two ways out if it grates: drop `position:
  sticky` (with five panels the column is taller than most viewports, so sticky
  clamps almost immediately and buys little), or give it
  `max-height:calc(100vh - 24px); overflow-y:auto` so it always fits and scrolls
  itself. Both are one line; neither was taken unilaterally.
- **The stage is blank until the program runs.** Deliberate (Phase 20d), but it
  is the first thing a new learner sees, so it may want a nudge in the Stage
  panel's help text — "press Play to build the world".
- **Setup rows above the flag are a placement TRICK.** They run once because
  `goto start` skips them, which is true but not stated anywhere in the program.
  Phase 22's scene `start` handler replaces the trick with a rule.
- ~~Two unrelated notions of range coexist~~ — **`VAR_META` is gone (Phase
  20e)**, so the per-statement `clamp` field is now the only range the system
  has. The open question is smaller and cleaner: does the language want BOUNDED
  VARIABLES at all, and is hitting a bound silent, a bubble, or a halt? Still a
  phase-sized pedagogical decision, but no longer a contradiction.

**Planned:**
- **A plain-English pass over all syntax** (Patrick): the language should read like
  `move ball to 10, 20` rather than like code. `move` was named with that in mind;
  `pack`/`unpack`/`visit` will want revisiting.
- **Named parameters on the pouch card** ("expects: n") — a contract surface that
  falls out naturally now that cards exist.
- A loadable factorial EXAMPLE (content, not code — the app has no program-switching
  UI, which is its own small feature).

**Deferred polish:**
- **Wire-endpoint dragging** (grab an arrowhead, drop it on another flag) — lovely
  direct manipulation, deferred on thin bezier hit targets.
- **Wrap the ROOT expression by drop:** the root RHS has no `data-sl` wrapper
  (isRoot), so an op tile can't target the whole root bin — only its operands. The
  operator tap-menu covers it; a drop path would need a root target element.
- Auto-open the fresh operand's editor after wrap? Currently flash-only.
- Undo stack + JSON export/import (both cheap on top of the verbs — see the drop
  model section). Drop-model Stage 3, only if a phase demands it.
- Tail calls (the pile that never grows). (Typed notes and palette tiles for
  notes moved into the Phase 18 plan.)
- Sprite equality (`⟨s⟩ is ⟨brick1⟩`) — deferred out of Phase 18, see its
  "deliberately NOT" list.
