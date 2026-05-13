# Plan — Add Vehicle Without VIN

## Context

Today the "Přidat vozidlo ručně" form on `/klientska-zona` requires a 17-character VIN before the user can save anything:

```html
<form>
  <h3 class="h6">Přidat vozidlo ručně</h3>
  <label class="form-label">VIN</label>
  <input
    class="form-control"
    placeholder="Zadejte VIN (17 znaků)"
    required
    type="text"
  />
  <button type="submit" class="btn btn-primary w-100">Přidat</button>
</form>
```

This blocks users who **know they own a car but don't have its VIN handy** — older vehicles, vehicles where the VIN sticker has faded, vehicles still in the registration process, or simply users in a hurry who want to save the car now and fill in the VIN later. Today they bounce.

The product value of `/klientska-zona` (reminders for STK, insurance, servisní prohlídka, dálniční známka) **does not actually require a VIN to deliver**. Reminders only need: the user, a chosen date, and a label so the user can identify which car the reminder is for. VIN is needed if-and-only-if the user wants to pull registry data — which is a "nice to have" overlay, not a requirement for the core reminder use case.

This plan unblocks the "vehicle without VIN" path while keeping the registry-lookup benefits available for users who do have the VIN.

## Constraints

- **No DB schema changes** if avoidable. The `client_vehicles` table already has `vin TEXT NULL` per the existing code in `api/client/vehicles.ts` — should confirm.
- **No regression for VIN users.** Existing flow must continue working unchanged.
- **Must remain unique.** Today a user can probably save the same VIN twice; we shouldn't introduce a new uniqueness problem with no-VIN entries.

## Proposed UX

### Form changes

Replace the single-field form with a two-mode form, defaulting to **"Mám VIN"** for the common case:

```
┌─────────────────────────────────────────────┐
│ Přidat vozidlo ručně                        │
│                                             │
│  ◉ Mám VIN     ○ VIN nemám                  │
│                                             │
│  VIN                                        │
│  [_______________________ 17 znaků]         │
│                                             │
│  [ Přidat ]                                 │
└─────────────────────────────────────────────┘
```

When the user clicks **"VIN nemám"**, the form swaps to:

```
┌─────────────────────────────────────────────┐
│  ○ Mám VIN     ◉ VIN nemám                  │
│                                             │
│  Název vozidla *                            │
│  [_________________________________]        │
│  např. "Rodinná Octavia", "VW Passat"       │
│                                             │
│  Značka (volitelné)        Model (volitelné)│
│  [______________]          [______________] │
│                                             │
│  ⚠ Bez VIN nelze načíst údaje z registru.   │
│    Upozornění a stav tachometru fungují     │
│    normálně.                                │
│                                             │
│  [ Přidat ]                                 │
└─────────────────────────────────────────────┘
```

Title becomes the required field (validation: 1–60 chars). Brand/model optional. Inline notice tells the user what they lose by skipping VIN — sets expectations.

### Validation rules

| Mode      | Required                               | Optional                                                            |
| --------- | -------------------------------------- | ------------------------------------------------------------------- |
| Mám VIN   | VIN (17 chars, alphanumeric, no I/O/Q) | Title, brand, model — can be filled from registry lookup after save |
| VIN nemám | Title (1–60 chars)                     | Brand, model                                                        |

Server-side check (in `api/client/vehicles.ts` POST handler): require either `vin` (17 chars) or `title` (non-empty after trim).

### Uniqueness

Today the `client_vehicles` table likely has a UNIQUE constraint on `(user_id, vin)` so a user can't save the same VIN twice. **Need to verify** the constraint allows multiple rows with `vin IS NULL` for the same user — most Postgres unique indexes do (NULLs are distinct). If not, drop the constraint or rebuild as a partial index: `CREATE UNIQUE INDEX … ON client_vehicles(user_id, vin) WHERE vin IS NOT NULL`.

No-VIN entries don't need a uniqueness guarantee — a user might legitimately have two "Auto bílé" cars; let them.

### Reminders & odometer for VIN-less vehicles

Both reminder and odometer-reading tables already key by `vehicle_id`, not VIN. **No changes needed.** Reminders, odometer readings, and email notifications all work for vehicles without a VIN.

The only thing that doesn't work for VIN-less vehicles:

1. **The "Info z registru vozidel" link** in the vehicle card → hide it when `vin == null`.
2. **The "Prověřit historii na Cebia.cz" affiliate link** → hide it (needs VIN).
3. **STK date** → hide the "STK do" stat row (no data source without registry lookup).
4. **Insurance affiliate links** → keep, but don't pre-fill the VIN query param.

These visibility rules live in `ClientZonePage.tsx`'s vehicle card render — wrap each in `{vehicle.vin && ...}`.

### Adding VIN later (deferred — not in this pass)

User saves vehicle without VIN, later finds it and wants to enrich the card with registry data. **Not implementing in v1.** The "Upravit název" button exists; we could extend it to "Upravit vozidlo" with both title and VIN fields. **Note as a follow-up** in this doc but don't ship in the first iteration.

## Files to modify

| File                                                                        | Change                                                                                                                                                    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/ClientZonePage.tsx`                                              | Replace the `AddVehicleForm` (or equivalent inline form) with the two-mode version. Conditionally render registry/Cebia/STK links per `vehicle.vin`.      |
| `src/utils/clientZoneApi.ts`                                                | `addVehicle()` signature already accepts optional `vin` and required other fields — check; widen if needed so `title` can be required and `vin` optional. |
| `api/client/vehicles.ts`                                                    | POST handler: require `vin OR title`. Validate. Allow null `vin` to be stored.                                                                            |
| `api/client/_db_schema.sql` (or whichever migration file lives in the repo) | If unique constraint blocks NULL-VIN rows for same user, swap to partial unique index. **Verify first — likely no change needed.**                        |
| `src/types/index.ts`                                                        | `ClientVehicle.vin` type — confirm it's `string \| null` already (per the existing render handling `vehicle.vin ?? 'N/A'`).                               |

## Pre-implementation investigation (do this first)

1. Open `api/client/vehicles.ts` — read current POST validation, confirm whether `title` is already an accepted field.
2. Open the DB schema / migration file — check the unique constraint on `(user_id, vin)`. If it's a strict `UNIQUE`, plan a migration.
3. Open `src/utils/clientZoneApi.ts` `addVehicle()` — check current TypeScript signature.

These three reads tell us whether the change is purely frontend or includes a migration.

## Verification

1. With VIN: existing flow unchanged. Save, see registry data populate. STK link, Cebia link, registry link all appear.
2. Without VIN: save a "Camper" with title only. Card appears with the title in `.plate-title`. STK row, registry link, Cebia link hidden. Reminders and odometer entry both work.
3. Try to save with both VIN blank and title blank → form validates, surfaces inline error.
4. Try to add the same title twice → both saved (no false uniqueness conflict).
5. Edit reminder, send a reminder email for a VIN-less vehicle → email arrives, vehicle name = title, promo blocks that branch on `hasVin` skip Cebia and instead show the insurance/benefits promo as appropriate (`api/_reminderEmail.ts` already handles this — `hasVin = vin && vin.length === 17`, false branch is graceful).

## Risk

- **Low frontend risk.** Pure form refactor + conditional rendering.
- **Low backend risk** if no schema migration is needed.
- **Medium backend risk** if the unique constraint blocks NULL-VIN — that's a real migration with deploy ordering implications.

Until the constraint is verified, treat as Medium overall.

## Effort

- Frontend: ~1.5 hours
- Backend (if no migration): ~30 min
- Backend (if migration needed): +1 hour planning + safe rollout

## Status

✅ Shipped (2026-05-13). Investigation confirmed:

- DB partial unique index `WHERE vin IS NOT NULL` already in place (`api/_db.ts:67-71`) — no migration needed.
- `addVehicle()` API client already accepts optional `vin` + `title`.
- Backend POST validation widened to also accept title-only payloads.
- AddVehicleForm switched to a two-mode UI (Mám VIN / VIN nemám) with the
  no-VIN mode requiring title and offering optional brand/model.
- Vehicle card: the Cebia affiliate link is hidden when the vehicle has no
  VIN. STK stat row was already conditional on a parseable date so VIN-less
  vehicles render without it naturally.
