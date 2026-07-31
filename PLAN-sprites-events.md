# Plan — sprite classes, instances, and the event-driven runtime (Phases 20–24)

Two features, deliberately sequenced so the first ships without the second:

1. **Sprite classes.** The learner defines a class (name + a few CSS-ish style
   options); the name enters the interpreter's namespace. Instantiation is an
   EXPRESSION (`a new Ball`), scene membership is a STATEMENT (`add ball to
   the scene`), and position is set with the existing `move`. The five
   hardcoded sprites become three classes (`Ball`, `Paddle`, `Brick`) and
   five instances.
2. **Events.** Each class carries a script. The engine visits `simulate` at a
   fixed interval with the sprite's **total overlap vector** staged in the
   visit pouch as two number parcels, so collision resolution is written in
   the handler. Keys stay POLLED (`isKeyPressed` inside `simulate`), and the
   `touch` event is DEFERRED — walls become ordinary sprite instances and
   overlap arithmetic covers what touch would have. rAF renders smoothly
   between simulation ticks.

## Decisions

**Settled (Patrick):** continuous motion is a `simulate` label visited at a
**fixed interval** — a fixed-timestep simulation. rAF is rendering only: the
engine keeps each sprite's previous and current tick positions and interpolates
between them, so a slow, watchable tick rate (~4–10 Hz to start, tunable
`SIM_DT`) still animates smoothly. This is also the determinism the suites
need: tests drive `tick()` directly and never touch rAF.

**Settled (Patrick): collision is the total overlap vector, not a `touch`
event.** Before each instance's `simulate` visit, the engine computes its
overlap vector against every other on-scene sprite — the vector between the
two centers, with length equal to the amount of overlap, as a signed (x, y)
pair; non-overlapping pairs contribute (0, 0) — and SUMS them. The total
rides the simulate pouch as two number parcels. Walls become ordinary sprite
instances around the play area, collision RESOLUTION is written in the
handler, and the `touch` event is deferred (see the deferred list).

**Defaults taken, awaiting sign-off:**
- **Event delivery: queued, run-to-completion.** A handler runs to its
  `return` (or the end of the script) before the next event dispatches to that
  instance. No interrupts, no re-entrancy.
- **Stepping: one scheduler, statement-granular.** Play executes whole ticks at
  the fixed interval; Step executes ONE statement of the current tick's
  deterministic schedule, and the editor auto-follows Beep into whichever
  script he is in. Same scheduler for both, exactly as `stepInstant` and
  `stepAnimated` share `nextPc` today.
- **Class editor options:** background-color, background-image,
  border-width / border-style / border-color / border-radius, plus **width and
  height** — not on the original list, but without size every class is one
  rectangle. (`border-radius: 50%` is how a Ball is round.)

## Data model

### Classes
`classes` registry: name → `{ name, w, h, style }` where `style` holds exactly
the editor's options as CSS declarations. Name rules follow flags
(`validFlagName` shape: letters/digits, ≤12, unique — and also not a world var
or note name; one namespace check). A class is **not a value type**: the only
thing code does with one is instantiate it, so it rides as a **chip** on the
`a new ⟨Class⟩` expression — the EDGES precedent (finite, chosen, never
computed, never stored).
If classes ever need to flow through expressions, that is the upgrade point.

### Instances
`instances` map: id → `{ cls, x, y, alive, el, ...exec state (Phase 21) }`.
An instance's DIV is created from the class style when it first enters the
scene; class edits restyle every live instance (one source of truth). `SPRITES`, `SPRITE_SIZE`,
`spritePos`, `spriteAlive` all dissolve into this map; `boxOf(id)` reads
instance position + class size and stays the one geometry function.

**Instance ids are the sprite VALUES.** Phase 18 already made a sprite value
its name string; ids keep a reserved spelling (`Ball·1`) so `valueType`
disambiguates by registry lookup, not by guessing. `despawn` keeps its
observable semantics — hidden, touches nothing, refs in notes stay safe — but
is reframed as leaving the scene (see the `add` section).
Reset destroys all instances; the seed scene respawns them.

### `a new ⟨Class⟩` — instantiation is an expression (Patrick's revision)
`{type:'new', cls}`: a sprite-typed leaf wearing the coral pill silhouette,
its class a tap-to-repoint chip. Each EXECUTION mints a fresh instance, which
starts **off the scene**: it exists as a value (position 50,50, movable,
storable, packable) but renders nowhere and receives no events.

**This is the language's one effectful expression, and that is a deliberate
amendment to "expressions stay pure."** The unpack lesson still binds:
`bubbleExpr` re-evaluates expressions to draw the thought bubble, and an
authoring-time scan may evaluate too, so naive evaluation would mint phantom
instances. The rule that keeps it safe — **instantiation happens exactly once
per execution**: during `execStmt`, the first evaluation creates the instance
and memoizes the id on the step; `bubbleExpr` reads the memo (the bubble
shows the instance the row actually made); evaluation OUTSIDE a live step
(bubble redraws, authoring scans, chooser previews) never creates — it
renders the phrase `a new Ball` symbolically. A mutant where a bubble redraw
mints an instance must go red.

What the expression buys: `new note ball = ⟨a new Ball⟩` — **the declaration
machinery needs ZERO changes.** `typeOf(new)` → `'sprite'`, the Phase-18 seed
slot already types the note from its seed, and the sprite-note chicken-and-egg
(no sprite value existed to seed with) dissolves, because this expression IS a
sprite-value source. Assign and pack also take it for free (`writeVar`'s
badtype door already guards a clash).

### `add ⟨sprite⟩ to the scene` — scene membership is a statement
`{type:'add', sprite}`: one ordinary sprite slot (`s.field === 'sprite'` →
already typed), nothing else. On-scene means: rendered, overlap-scanned,
`simulate` delivered; the `spawn` label fires on ENTERING the scene,
the `despawn` label on LEAVING it. Adding an instance already on the scene is
a visible no-op bubble (the `empty` idiom).

The pleasing symmetry: **the `despawn` statement becomes the inverse — it
removes from the scene, and `add` can bring the same instance back.** `alive`
reads scene membership; a re-added instance re-fires `spawn` (safe: `new
note` already no-ops when the name is declared in this pouch). Since the
EVENT labels are named `spawn`/`despawn`, the plain-English pass will likely
rename the statement to `remove ⟨s⟩ from the scene` so statements read
add/remove and events read spawn/despawn — one pair of verbs for the learner's
actions, one for the engine's announcements. Shelf proto default:
`add ⟨a new class1⟩ to the scene`.

**Expected DROP_TABLE cost: zero new rows** — a class chip, one existing
sprite slot, and a sprite-typed value prototype are all served by current
payloads and targets. Verify in tests, as Phases 11b/12/13 did.

## The event runtime

### Execution contexts
Today `program`, `pc`, `pouches`, `open` are module globals. They become a
**context**: `{ script, pc | idle, pouches, open, self, queue }`. The scene
has one; every instance has one. The engine sets a module-level `cur` before
running a context, so `readVar`/`writeVar`/`labelIndex`/`nextPc` keep their
shapes with minimal diff.

**Name resolution per context:** handler frames → instance pouch → world.
Concretely `ctx.pouches = [worldPouch, instancePouch, ...frames]`, sharing
`worldPouch` by identity — the exact Phase-14 trick that kept `state` working.
Per-instance notes fall out: three Bricks share one script but each has its
own pouch. The scene context has no instance pouch: `[worldPouch, ...frames]`.

### Event labels — ordinary labels the engine visits
`spawn` (on entering the scene) · `despawn` (on leaving it) · `simulate`
(every tick, total overlap vector in the pouch) · scene-only `start` (once,
on Play-from-reset). They are ordinary labels: rename or delete one and the
events simply stop arriving — unsubscribing, visible, no halt (a script with
no `simulate` label just holds still). Labels whose name currently matches an
event render with a ⚡ badge so "this is a door the engine knocks on" is
legible.

### Delivery — the Phase-14 machinery, engine-initiated
Dispatching an event to a context: stage a pouch with the event's parcels
already inside (`simulate` to an instance: the total overlap vector as two
number parcels, x then y; scene `simulate` and the rest: empty), push it
with `ret: SYSTEM` (a sentinel, not a row), set pc to the label. The handler
unpacks its arguments exactly as any visit does — and a handler that doesn't
care simply never unpacks; leftovers die with the frame (Phase 14, T19).
`nextPc`'s `ret` door gets one case: `ret === SYSTEM` → pop, context idle;
undelivered results are discarded (there is no caller). **Falling off the end
of a script is an implicit `return`** — wrap-to-top dies with the event model
(see semantic breaks below).

### The tick — deterministic, budgeted
Per tick, in fixed order: (1) SNAPSHOT — every on-scene instance's total
overlap vector is computed from start-of-tick positions, all at once, so no
instance's move changes what a later instance is told (order-independence is
a mutation target); (2) `simulate`, scene first then on-scene instances in
scene-entry order, each with its precomputed vector staged. Each delivered
handler runs to completion before the next dispatches. `spawn` dispatches when `add` puts the instance on the scene and
`despawn` when a removal takes it off, each queued behind the handler that
caused it; a `despawn` handler runs with the instance already off the scene
(notes and `myself` still readable — a last word, not a veto), and a removal
inside one is a visible no-op. A per-context
`STEP_BUDGET` (~500 statements/tick) turns an infinite loop into Beep stuck
("I never finished thinking!"), pc parked — the halt-surface idiom, and a
teachable failure replacing today's silent forever-loop.

**The overlap vector, precisely.** Per pair: direction along the line between
the two centers, pointing from the other sprite toward THIS one (a push-out),
magnitude = the amount of overlap. For boxes, "amount of overlap" should be
the SHALLOWER axis penetration — `min(overX, overY)` — which is the
`isClosingOn` per-axis lesson resurfacing: the shallow axis is the axis just
crossed. Coincident centers (no direction) contribute (0, 0). Non-overlapping
pairs contribute (0, 0). Totals are the plain vector sum, which is what makes
simultaneous contacts compose: ball meets wall AND brick in one tick → ONE
net vector, and the sign guards below fire each axis at most once — the 13b
double-flip hazard dissolves by construction. A corner hit sums two walls
into a diagonal and both guards fire: a correct corner bounce for free.

**Oscillation is solved IN THE PROGRAM, visibly.** The vector is
level-triggered (recomputed every tick), but the bounce guard is one row of
arithmetic: `if ox × vx < 0 visit flipX` — flip only when the push-out
opposes the velocity. After the flip the product turns positive, so a resting
overlap flips exactly once. The rule that keeps the ball out of the paddle is
readable program text — the whole `isClosingOn` saga, reduced to a
multiplication the learner owns. Polling sensors (`isTouching`, edge tests,
`isKeyPressed`) all remain legal inside handlers; the seed no longer needs
the edge tests (walls are sprites) or `isClosingOn` (the sign guard).

### New language material
- **`myself`** — `{type:'self'}`, sprite-typed, evaluates to `cur.self`; the
  one static sprite pill left once the seed rewrite lands. In the scene script
  it is a dangling reference (frayed; halts) — palette shows it only when a
  class script is focused.

That is the whole list: input stays the existing `isKeyPressed` hexagon,
polled inside `simulate`, so no key value type, no key literals, and no
equality node are needed. Sprite equality stays on the deferred list where
Phase 18 left it.

## UI

- **Class panel** (new side panel, rides `initPanels`): one card per class —
  the card's swatch IS a live DIV styled by the class; name chip renames as
  refactor (`a new ⟨Class⟩` chips and choosers follow); tapping the swatch opens a
  chooser popover (`openChoicePop` idiom, `popSection` per option group:
  colors as swatch grids, width/style/radius as small numeric/step inputs).
  "+ new class" mints an always-valid default (gray 20×20 `class1`). Deleting
  a class whose name is held by `a new ⟨Class⟩` nodes gets the label-deletion
  treatment: confirm with holders highlighted, then those chips fray.
- **Script editing:** the blocks editor shows ONE script at a time — the scene
  by default; tap a class card (or a stage sprite) to open its script. Each
  script keeps its own `programSeed`, tray stays global chrome.
- **Beep:** one robot. During Step the editor auto-follows him; during Play he
  stays home (as today's fast mode effectively does). A badge on class cards
  shows "Beep is here" when he is in a hidden script.
- **Backpack** shows the followed context's pile: world card pinned at bottom,
  an instance card (labelled with the instance's pill) above it, frames on
  top. The two-state toggle survives unchanged.

## Seed rewrite sketch (Phase 24 — harness first)

    scene:  ⚑ start
            new note w = ⟨a new Wall⟩          (Wall: full-width, thin)
            move w to 50, −6 / add w to the scene       (top; likewise bottom,
            …and two tall thin Walls at the left and right edges)
            new note paddle = ⟨a new Paddle⟩
            move paddle to 50, 95 / add paddle to the scene
            new note ball = ⟨a new Ball⟩
            move ball to 50, 55 / add ball to the scene
            new note brick1 = ⟨a new Brick⟩
            move brick1 to 10, 14 / add brick1 to the scene
            (…brick2 at 45, brick3 at 80)

    Ball:   ⚑ spawn     new note vx = 2 / new note vy = 3
                        new note ox = 0 / new note oy = 0
            ⚑ simulate  unpack into ox / unpack into oy
                        if ox × vx < 0 visit flipX     (pushed against my motion)
                        if oy × vy < 0 visit flipY
                        move myself to x of myself + vx, y of myself + vy
            ⚑ flipX     vx = 0 − vx / return    (⚑ flipY likewise)

    Paddle: ⚑ simulate  if ← isKeyPressed visit goLeft
                        if → isKeyPressed visit goRight
            ⚑ goLeft    move myself to x of myself − 8, y of myself / return
                        (⚑ goRight likewise — the 13b subroutine shape, verbatim;
                         the overlap parcels are simply never unpacked)

    Brick:  ⚑ simulate  unpack into ox…oy (notes from ⚑ spawn, as Ball's)
                        if not (ox = 0 and oy = 0) visit gone
            ⚑ gone      despawn myself / return

    Wall:   (empty script — a wall is geometry that stands there)

Notable wins: `paddleX`/`ballX`/`ballVelocity*`/`brick*X` leave the world —
positions live on sprites, velocities are Ball's own notes; the three brick
handlers collapse into `Brick`'s script (absorbing 18d); the bounce rule is
one visible sign guard per axis; walls, paddle, and bricks are all the same
thing to the ball — one net overlap vector.

(Note `ox`/`oy` declared in `⚑ spawn`: instance notes, so `unpack into` in
`simulate` write-through finds them — no per-tick declaration needed. And the
one-statement-conditionality friction from Phase 19 is why `flipX`/`gone` are
subroutines, not inline pairs.)

**Harness first, still.** The composition claims above (double-flip dissolved
by summing; corner = diagonal; resting overlap flips once via the sign guard)
are exactly the kind of thing 13b taught us to REPRODUCE, not assert. Harness
targets: ball spanning wall + brick in one tick; a corner hit; a slow ball
resting on the paddle for several ticks; a deep overshoot past a wall (does
min-axis penetration push it back out, or does it tunnel?). Tunneling at high
velocity is a real risk of overlap-based resolution — cap seed velocities
below the wall thickness per tick, and note it as a known limit. One more
layout constraint the sum imposes: a Brick despawns on ANY overlap (the sum
erases identity), so bricks must rest clear of each other, the walls, and
anything else — a resting neighbor would vaporize the row at tick one.

## Semantic breaks, named
- **Wrap-to-top is gone.** A script is a set of handlers, not a loop;
  `goto start` at the bottom of the old seed has no analog. No saved-program
  format exists yet, so nothing migrates.
- **Play speed** is now `SIM_DT` per tick rather than 30ms per statement;
  choose `SIM_DT` so gameplay speed roughly matches (one old full pass ≈ one
  tick ≈ ~300ms), then tune.
- `spriteVel` (the last convention-bound engine read) dies. The seed no
  longer needs `isClosingOn` at all — the overlap sign guard replaces it —
  but the sensor stays in the language, so it gets the fix PROJECT_STATE
  already prescribes: velocity derived from per-tick position deltas.

## Phases

**Phase 20 — classes and instances under the OLD runtime** (behavior-preserving)
- 20a: `classes`/`instances` registries; DIVs generated, CSS moved out of the
  stylesheet into three seed class defs; ids = legacy names so `sprite{name}`,
  pills, and all ten suites stay green. Gameplay byte-identical.
- 20b: class panel + editor popover + rename/delete treatments.
- 20c: the `a new ⟨Class⟩` expression (once-per-execution memo rule) and the
  `add ⟨sprite⟩ to the scene` statement (membership, `despawn` as its
  inverse); Reset destroying spawned instances; DROP_TABLE zero-row check.
- Tests: extend `test-sprite.js`; mutants: class edit not restyling live
  instances; a bubble redraw or authoring scan minting a phantom instance;
  an off-scene instance drawn or overlap-scanned; re-`add` double-firing;
  Reset leaking instances; class delete bypassing the confirm.

**Phase 21 — contexts** (pure refactor, all suites stay green)
- Factor `program/pc/pouches/open` into contexts + `cur`; scene context wraps
  the existing single program; `__call` seam targets the scene context.
- Mutant: two contexts sharing a frame list (isolation must be structural).

**Phase 22 — the event engine** (the big one)
- 22a: scheduler — tick order, budget, SYSTEM return, implicit end-of-script
  return, `__evt` seam (`tick()`, queue inspection). No rAF anywhere in tests.
- 22b: event sources — the overlap engine (per-pair vector, min-axis
  penetration, vector sum, start-of-tick snapshot), `spawn`/`despawn`, scene
  `start`; delivery via staged pouches.
- 22c: `myself`; `valueType` reads the instance-id registry; palette updates.
- 22d: rAF interpolation (prev/curr positions; paused = authoritative draw).
- Mutants: overlap read live instead of from the snapshot (an earlier
  instance's move changes a later one's vector — order-dependence); sum
  replaced by last-pair-wins; non-overlapping pair contributing non-zero;
  magnitude using the DEEPER axis (the dot-product bug's cousin); budget
  removed (hang); a handler's undelivered results leaking to another context;
  interpolation feeding positions back into `boxOf` (render must never write
  simulation state).

**Phase 23 — multi-script UI**
- Script switching, Beep auto-follow, per-script backpack, ⚡ badges, per-script
  Reset/seed. New suite for switching + follow.

**Phase 24 — the seed rewrite + suite migration**
- Harness-first for the overlap composition claims and the tunneling limit;
  then the seed above (including the `Wall` class); retire the five static
  sprite pills and legacy names; rewrite the movement/collision halves of
  `test-sprite.js` and the run-loop parts of `test-call.js` against `__evt`;
  PROJECT_STATE update.

**The single biggest cost is test migration** (661 asserts, many driving
`stepInstant` on a global program). Phases 20–21 are deliberately
suite-preserving so the risk concentrates in 22/24, where `__evt`'s
deterministic `tick()` is the new keystone seam.

## Deliberately not in this plan
- **The `touch` event** (Patrick's deferral). The overlap vector covers
  collision resolution, and walls-as-sprites cover what edge events would
  have. `touch` earns its way back if a script ever needs to know WHICH
  sprite it met (the overlap sum deliberately erases identity) — sprite
  equality would return with it. The design stands ready: other instance as a
  pouch parcel, same staged-pouch delivery.
- **`keypress` events and a key value type** (Patrick's cut). Polling
  `isKeyPressed` inside `simulate` covers input; the tick IS the sample rate,
  so polling loses nothing a queued per-tick event would give. If a script
  ever needs to know WHICH arbitrary key beyond the sensor's fixed set, the
  reintroduction is already designed: a `keypress` label, the key as a pouch
  parcel, a `key` value type + literals, and an equality node — all riding the
  same staged-pouch delivery `touch` uses.
- Class serialization / export (rides the deferred JSON export item).
- Multiple robots (one Beep; concurrency is shown by the schedule, not by a
  crowd).
- `background-image` validation beyond "it's a CSS value in one declaration";
  no file uploads.
- Instance-count expressions, class-as-value, per-instance style overrides —
  all future material, none needed by breakout.
