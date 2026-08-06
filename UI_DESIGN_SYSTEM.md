# UITH School Complex Clinic UI Design System

## Design Concept

The public entrance is image-led and institutional. Authenticated portals are
quiet clinical workspaces designed for scanning, repeated action and traceable
handoffs. React-Bootstrap, local CSS tokens and Remix icons are reused.

## Role Dashboards

| Role | First responsibility | Primary workspace |
|---|---|---|
| Doctor-in-Charge | Oversee queues, staff and system activity | Clinic overview |
| Doctor | Treat assigned students | My consultation queue |
| Nurse | Review intakes and schedule doctors | Intake queue |
| Receptionist | Register students and submit intakes | New intake |
| Student | Track personal care progress | My care journey |

Each dashboard has its own title, responsibility text, metrics, queues, empty
states and quick links. Navigation is generated from `roleCapabilities.js`.

## Workflow Components

- `ReceptionIntake`: patient search, registration link, complaint and submission.
- `ReceptionIntakes`: reception-owned status monitoring.
- `NurseQueue`: review, doctor selection, schedule and reschedule controls.
- `DoctorQueue`: confirm, start, clinical-workspace and completion controls.
- `CareJourney`: nine text-and-icon stages with dates and 30-second refresh.
- `ClinicOverview`: reassignment, controlled correction and archive operations.

Queue cards use a maximum 6 px radius and are never nested. Status badges always
include text. Tables scroll or restack on narrow screens rather than shrinking
content into unreadable columns.

## Landing Page

The original full-bleed clinic hero remains the first viewport. Lower sections
use short copy and visual structure: trust strip, portal choices, keyboard-aware
five-stage workflow, four synthetic product previews, capability bento grid,
dark security band, student timeline, project identity and conditional demo
access. No new third-party asset or hotlink is used.

## Tokens And Type

Central variables live in `frontend/src/styles/tokens.css`. Institutional blue,
gold, clinical green, amber, red and pale neutral surfaces form a multi-hue
palette. Operational headings remain compact. Font size never scales with
viewport width, letter spacing is zero, and controls use visible focus states.

## Responsive And Accessibility Rules

- Sidebar becomes a labelled drawer below 991 px.
- Workflow stages stack vertically below 768 px.
- Forms, previews, metrics and demo counts become one column when needed.
- Touch controls remain at least 40 px; icon-only buttons have names/tooltips.
- Complete/current/pending states use icon, label and text, not colour alone.
- `prefers-reduced-motion` removes nonessential transitions.
- Verified widths: 360, 390, 430, 768, 1024 and 1440 px with no page overflow.
