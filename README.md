# MediLink Hospital Patient Medication Administration System

This project is a Node.js + Express + MongoDB medication subsystem built for MediLink.

## Features
- secure login using the shared users collection
- patient and medication profile lookup
- patient-scoped medication history for orders, administration records, exceptions, and reconciliations
- medication catalog management
- medication order creation and verification
- read-only medication alerts, including current pending-verification orders
- scheduled-dose reminders at the due time or up to 24 hours beforehand, with configurable delay and review thresholds
- interval-based schedules for verified, active medication orders
- medication administration records linked to their order and schedule
- automatically linked delayed, missed, refused, omitted, and withheld exceptions
- pharmacist / medication-administrator exception review with follow-up notes
- patient-validated medication reconciliation with discrepancy documentation
- date-range reports for orders, schedules, administrations, exceptions, and reconciliations
- dashboard summary and reporting
- medication-administrator facility settings
- role-restricted audit log viewer
- audit log support
- role-gated patient registration and editing, searchable patient profiles, and medication-linked detail views

## Patient data dictionary and compatibility
- Patient records are stored in the existing `patients` collection. New records receive a generated unique `patientId`; the API validates the dictionary's required personal/contact fields and preserves nullable medical and insurance values.
- The shared MongoDB schema stores the emergency-contact number as `emergencyContact.contactNo`, alongside `emergencyContact.name` and `emergencyContact.relationship`. The API reads the legacy `emergencyContact.phone` field but writes the shared `contactNo` field.
- New measurements use `medical.heightCm` and `medical.weightKg`. Existing records that use the legacy `medical.height` and `medical.weight` fields remain untouched; patient profile responses expose those legacy values through the canonical `heightCm` and `weightKg` fields when no canonical value is set.
- Patient list search supports ID, first/middle/last or combined name, contact number, and email. Filters and pagination are applied by the authenticated patient API.

## Scheduling behavior
- Fixed schedules support `Every N hours` for 1–24 hours and `Daily`, `Once daily`, or `Once a day`, anchored to the order start time.
- PRN orders are not scheduled; they can be recorded as unscheduled administrations.
- Other frequency formats are rejected during schedule generation rather than interpreted as a different dosing interval.
- Schedule generation creates a 30-day window and can be repeated without creating duplicate entries.
- An order must be verified before it becomes active and can be scheduled or administered.
- Dashboard day-based counts use the application server timezone; configure `TZ` to the facility timezone.
- In-app dose reminders default to the scheduled time. Medication administrators can set a reminder lead time from 0 to 1440 minutes in Facility Settings; the alert badge and open alert page refresh about once a minute. Delay-warning and unrecorded-dose review defaults remain 30 and 120 minutes. These reminders do not mark doses administered or missed; staff must verify the active order and record the actual outcome. Notifications are in-app only and are not delivered when the application is closed.

## Setup
1. Copy `.env.example` to `.env` and adjust values.
2. Install dependencies: `npm install`
3. Start the app: `npm start`
4. Open `http://localhost:5000`

## Use the shared MongoDB database
- Set `MONGODB_URI` in the ignored local `.env` file to the Atlas connection string for `medilink_lab_dev`. Never commit or paste the URI into chat.
- The app reuses the existing `patients` and `users` collections. Existing `lab_admin` users receive medication-administrator permissions in the app session; their stored role is not changed. Existing lowercase `status` and `updatedAt` fields are supported.
- Patient records remain in Atlas and are not copied. The API reads existing `emergencyContact.contactNo` values and continues to read the older `.phone` field.
- To review a safe migration of non-patient-linked local data, run `node backend/scripts/migrate-shared-database.js --dry-run`. It reports conflicts without writing. After reviewing the result, apply with `node backend/scripts/migrate-shared-database.js --apply --confirm medilink_lab_dev`. Existing Atlas documents are never overwritten.
- Local medication orders, schedules, administrations, exceptions, reconciliations, and alerts are deliberately excluded because they reference the local demo patient `P-1001`; do not attach those records to an Atlas patient unless a clinician confirms the identities and mapping.

## Create a local development user
The app uses MediLink's shared users collection and does not create default login accounts. To create an account in a local MongoDB database, run this from an interactive PowerShell terminal:

```powershell
$env:ALLOW_LOCAL_USER_BOOTSTRAP = '1'
npm run create:local-user
Remove-Item Env:ALLOW_LOCAL_USER_BOOTSTRAP
```

The command refuses production mode and non-local MongoDB hosts, asks you to confirm the database name, and prompts for your password without displaying it. The account is created as Active. Choose an appropriate role carefully; the bootstrap command is for local development only.

## Tests
Run `npm test`. Medication and patient workflow suites use separate isolated local MongoDB databases when available and fall back to MongoMemoryServer otherwise.
