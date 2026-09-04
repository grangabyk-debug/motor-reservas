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

## Observation log

| Time | Reference | Action | Observation | PMS Next action |
|---|---|---|---|---|
| 2026-09-04 | Hotelgest tutorial | Planning general view | Single continuous timeline; room bars align to date columns; reservation creation works from grid | Replace segmented vertical backgrounds with a single calendar surface |
| 2026-09-04 | Current PMS Next | Click/hover reservation | Preview can be clipped by row/calendar stacking and appears broken | Move preview out of reservation DOM flow into top-level overlay/portal |
| 2026-09-04 | Current PMS Next | Weekend/today visual layers | Weekend and today coloring restarts inside group/room rows, creating broken bands | Render global vertical background bands once behind all rows |

## Connection note

Opera Browser Connector disconnected while starting the Heroes live-demo session. Continue this exact script when the connector is active; append every observed action/result here before changing PMS Next behavior.
