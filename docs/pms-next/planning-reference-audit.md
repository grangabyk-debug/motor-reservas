# PMS Next · Planning reference audit

Purpose: persistent QA/behavior log for rebuilding Habitación Llena Planning from observable PMS behavior only. This file records what is seen and tested; it does not copy third-party source code.

## Session baseline

Branch: `pms-rebuild-zero`
Target: `/pms-next?view=planning`
Primary references: Heroes PMS live demo + Hotelgest tutorial/video + public product documentation.

### Confirmed reference behavior from public Heroes PMS documentation

- Gantt planning is drag-and-drop.
- Drag a booking to change room and/or dates.
- Stretch the booking bar to extend/reduce a stay.
- Double-click an empty cell to create a stay.
- Conflict validation happens visually before save.
- Changes save in the background without a page reload.
- Filters can include room/type/status/team/OTA.
- Day / week / month information density is supported.
- Reservation colors represent operational/payment/arrival states and can be property-specific.
- Large datasets are expected to remain fluid; off-screen rows may be virtualized.

## Live-demo interaction script

For each test capture: URL/date range, screenshot before, action, screenshot after, visible panel/modal, labels/actions, validation, persisted result and any navigation change.

1. Open Planning and record default density, sticky headers, date scale, room/group rows and today/weekend treatment.
2. Hover reservation `C12` (or equivalent visible test booking): record tooltip/card position, fields, delay and overflow behavior.
3. Single-click reservation: record drawer/modal, dimming, available actions and whether the grid remains visible.
4. Close detail view: verify position/scroll/date range is preserved.
5. Horizontal drag one reservation by one day: record ghost, target highlight, conflict indicator, save feedback and final bar geometry.
6. Vertical drag to another room without changing dates: record valid/invalid target treatment.
7. Diagonal drag room + date: record whether allowed, confirmation behavior and conflict detection.
8. Resize right edge by one night: record handle visibility, live duration/price feedback and save result.
9. Attempt resize/move into occupied cells: record exact conflict UI and whether saving is blocked before mutation.
10. Double-click an empty cell: record creation UI and prefilled room/date.
11. Select/drag a multi-day empty range if supported: record range highlight and confirm/cancel affordances.
12. Complete reservation creation through all steps; record required fields, room/rate availability, guest data, status/channel and final result.
13. Cancel creation midway: verify no phantom booking remains and prior scroll/date position persists.
14. Open view/settings controls: record zoom/density, availability, occupancy, price, booking ID, weekend shading and filters.
15. Search/filter by guest, room, OTA and status: confirm filtering never changes real inventory/availability counts.
16. Switch date density/view and navigate previous/next/today: verify a single continuous time scale and no broken vertical overlays.
17. Open the same booking again after move/resize: verify detail data matches the Gantt bar.
18. Reload page: verify committed changes persist and temporary hover/selection state does not.

## Habitación Llena acceptance criteria

- One authoritative horizontal day scale for header, inventory, rooms, reservations, today marker and weekend bands.
- Weekend shading and today marker must be continuous vertical layers, never restarted per room/group.
- Reservation bars must be positioned from dates, not by independent nested-grid auto placement.
- Hover/preview content must render in a portal/fixed overlay so no row/container can clip it.
- Click detail drawer must always remain fully visible above the calendar.
- Drag/resize target geometry must snap exactly to date columns.
- Availability is calculated from unfiltered source data; search/display filters never alter inventory truth.
- Failed/conflicting operations must leave the original reservation untouched.
- Successful operations update optimistically only when rollback is guaranteed on server rejection.
- Calendar scroll position and visible date range should survive opening/closing drawers.
- Light and dark themes must use the same geometry.

## Live Heroes baseline — 2026-09-04

Opera connection is active on `https://v2.heroespms.com/planning` with the Demo Grand Hôtel calendar visible.

Observed directly from the live screen/accessibility tree:

- Left room column is a single fixed strip with rooms 101, 102, 103…; there are no room-type group header rows interrupting the Gantt.
- Date header is one continuous horizontal sequence of equal-width day columns.
- The current day is indicated in the header with a filled blue date badge and a single vertical blue guide aligned to the same x-coordinate through the calendar.
- Weekend/non-working columns are neutral vertical bands that visually continue through all room rows rather than restarting per row.
- Room rows share the same horizontal day scale; borders form one coherent matrix.
- Reservations are compact rounded horizontal pills/bars placed over the matrix. Their width maps directly to their visible stay duration.
- Reservation visual states are differentiated mainly by border/fill color (for example teal outline, red outline, solid red) while preserving identical geometry.
- Booking bars are exposed as actual interactive buttons in the accessibility tree, e.g. `D Elena Petrova`, `D Fatima Zahra`, `D Henrik Olsen`, `D Maria Garcia`, `D Jean Dupont`, etc.
- Room numbers themselves are interactive controls and each row also exposes an operational/maintenance status control.
- The calendar keeps a large uninterrupted viewport and does not insert availability summary rows between room rows in the default Heroes view.
- Top controls remain outside the Gantt surface: Today, year/month navigation, filter/search and New reservation.

Important consequence for PMS Next: the current type-group availability rows and per-row weekend/today backgrounds should not define the geometry of the calendar. The time surface should be global; summaries, if retained, must not break vertical continuity.

## Observation log

| Time | Reference | Action | Observation | PMS Next action |
|---|---|---|---|---|
| 2026-09-04 | Hotelgest tutorial | Planning general view | Single continuous timeline; room bars align to date columns; reservation creation works from grid | Replace segmented vertical backgrounds with a single calendar surface |
| 2026-09-04 | Current PMS Next | Click/hover reservation | Preview can be clipped by row/calendar stacking and appears broken | Move preview out of reservation DOM flow into top-level overlay/portal |
| 2026-09-04 | Current PMS Next | Weekend/today visual layers | Weekend and today coloring restarts inside group/room rows, creating broken bands | Render global vertical background bands once behind all rows |
| 2026-09-04 19:48 AR | Heroes live demo | Default Planning view | Fixed room column + one uninterrupted day matrix; no type separator rows; today and neutral day bands share a single continuous x-axis | Rebuild PMS Next body around one authoritative calendar canvas |
| 2026-09-04 19:48 AR | Heroes live demo | Inspect interactive elements | Reservation bars and room labels are first-class interactive controls; bars keep identical geometry across statuses | Keep interaction layer independent from background/grid layer |

## Connector capability note

The current Opera Browser Connector session can read tabs, accessibility content, screenshots, history and navigate URLs. It does not expose a click/drag/resize command to ChatGPT in this session. Therefore live pointer interactions (click booking, drag, resize, double-click) must be observed by capturing before/after states while a human performs the pointer action. Do not infer an unobserved movement result.
