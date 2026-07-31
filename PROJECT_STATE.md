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
- **Persisted:** `beep.html`, this file, the nine `test-*.js` suites,
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
since applied to runtime references too (Phase 13 bookmarks), three instances of
one rule.

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
  parent types.

## AST model (quick reference)
- **Statements:** `label`, `goto`, `ifjump`, `ifvisit`, `visit`, `return`,
  `assign`, `command`, `pack`, `unpack`, `note` (`new note n`). The control-flow
  grid is (one-way | comes-back) x (always | if) and all four cells are filled:

  |                            | always  | if        |
  |----------------------------|---------|-----------|
  | one-way (never comes back) | `goto`  | `ifjump`  |
  | visit (comes back)         | `visit` | `ifvisit` |

- **Expressions:** `num`, `var`, `bin{op,left,right}`. Booleans: `key`, `bool{value}`
  (literal), `cmp{op,left,right}` (boolean-typed, but its OPERANDS are numbers),
  `not{operand}` (the only UNARY node), `touch{left,right}`, `closing{left,right}`,
  `edge{sprite,edge}`, `alive{sprite}`. Sprites: `sprite{name}`, `prop{prop,sprite}`
  (`x/y of`). A `bin` is BOTH number and boolean material: it takes its type from
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

**Counts asserted by the suites** (bump them when the shelf grows): **37** piece
prototypes (`.proto:not(.stmt-tile)`) = 1 num + 8 vars + 2 keys + touch + edge +
closing + 5 sprites + 3 readings + 2 yes/no + 6 comparisons + 7 ops; **12**
statement prototypes; **4** side panels (Stage / backpack / new pieces / spare
tiles); **4** help discs.

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
- **`boxOf(name)`** — the ONE geometry function. Phase 17's `ballBox`/`paddleBox`/
  `brickBox`/`spriteBox` had all decayed into `return boxOf(name)` and are gone;
  `__lang.spriteBox` still points here so the suites read naturally.
- **`clearRunMemory()`** — a run's memory dies with the run. Both doors into a
  fresh run (the Reset button, the `__call.load` seam) go through it, so they
  cannot drift apart.
- **`popSection(title)` / `commitThen(fn)`** — a titled chooser sub-section, and
  the "flush the half-typed number before acting" wrapper both "wrap in" and
  "take out" need.
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
flag below on drop** (`bindJumpTarget`). A shelf/tray statement becomes a REAL block
at once (`startMaterializedDrag`) and rides the ordinary reorder machinery; a mere
tap `unmaterialize`s it. ONE tray holds both statement tiles (`.stmt-tile`, never in
`slotReg`) and expression tiles. Reset restores the whole LIST from `programSeed`.
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
A **note** is a variable living in a pouch; the eight game variables are simply the
world's notes. The **open pouch** is an always-present staging pouch above the active
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

### Suite status — all nine green, **569 asserts**
| suite | asserts | covers |
|---|---|---|
| `test-phase8.js` | 30 | palette, mint-on-drag, replace/wrap, shelf counts |
| `test-phase9.js` | 65 | statements as material, panels, help discs, nemesis, chips |
| `test-drop.js` | 33 | `DROP_TABLE` totality + the `accepts` gate, exhaustively |
| `test-grammar.js` | 36 | `×`/`÷` and the op registry |
| `test-diverror.js` | 18 | divide-by-zero, both surfaces, incl. `move` coordinates |
| `test-compare.js` | 81 | comparisons: eval, flip-is-negation, drop, refusals |
| `test-bool.js` | 84 | and/or/not, in===out, De Morgan, identity-is-a-no-op |
| `test-sprite.js` | 94 | Phases 12 and 15–17, incl. the per-axis `isClosingOn` regressions |
| `test-call.js` | 128 | Phases 13/13b/14: staging, resolution matrix, factorial, every halt |

`test-call.js` was REWRITTEN at Phase 14 (the Phase-13 pack/unpack tests are gone by
design, not preserved).

## Open threads / next
**The one blocker that matters:**
- **Sprite-valued parcels.** Pouches are numbers-only, so the three brick hits still
  cannot be one routine. `pack brick1` / `unpack into <sprite note>` would finish it,
  which needs typed notes as well as typed parcels. This is the single remaining
  reason the seed program uses no notes or parcels.

**Known limits worth fixing:**
- **`spriteVel` is the LAST convention-bound thing left.** It reads
  `state.ballVelocityX/Y` BY NAME, so `isClosingOn` only really works for the ball —
  the paddle genuinely moves (`nudgePaddle`) but reads as stationary, and a learner
  who builds movement without those variables gets `{0,0}`. Now that sprites own their
  positions the fix is cheap: cache each sprite's position per pass and derive
  velocity from the delta. Convention-free, works for any sprite moved by any means.
- **Two unrelated notions of range coexist:** the per-statement `clamp` field (present
  on exactly two rows) and `VAR_META` (`paddleX:{min:0,max:100}`,
  `ballVelocityX:{min:-12,max:12}`) which today only configures the backpack widget.
  The authoring UI knows paddleX lives in 0..100; the interpreter does not. Unifying
  them = deciding whether the language has BOUNDED VARIABLES at all, and whether
  hitting a bound is silent, a bubble, or a halt. A phase-sized pedagogical decision.

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
- Tail calls (the pile that never grows); typed notes; palette tiles for notes.
