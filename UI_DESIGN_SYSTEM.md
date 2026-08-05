# UITH School Complex Clinic UI Design System

## Design concept

The interface is a quiet clinical operations system with a more expressive,
image-led public entrance. Authenticated screens prioritize repeated work,
comparison, traceability and readable data density. The existing React,
React-Bootstrap and `react-icons` implementation was redesigned in place.

## Brand hierarchy

- Primary institutional color: `#003366`, extracted from the original
  horizontal application header.
- Deep navigation color: `#002447`.
- Institutional gold accent: `#C59B47`.
- Clinical teal accent: `#087F8C`.
- Gold is reserved for institutional emphasis and key dividers; teal marks
  clinical context; red, green and amber retain status meanings.

## Tokens

Central CSS custom properties live in `frontend/src/styles/tokens.css`.

| Category | Tokens |
|---|---|
| Surfaces | `--surface`, `--surface-subtle`, `--surface-muted` |
| Text | `--ink`, `--ink-muted` |
| Brand | `--brand-primary`, `--brand-primary-strong`, `--brand-gold`, `--clinical-teal` |
| Status | `--success`, `--warning`, `--danger`, `--info` |
| Radius | 4 px controls; 8 px panels/modals |
| Shadows | restrained 2 px and 12 px depth levels |
| Layout | 252 px desktop sidebar; 68 px top bar; 1560 px content maximum |

## Typography and spacing

The local system font stack begins with Segoe UI, avoiding external font
requests. Page headings are 28 px desktop and 23 px mobile. Operational panel
headings remain compact. Spacing uses a 4/8/12/16/24/32/48 px progression.
Letter spacing is zero; uppercase eyebrow labels rely on weight and size.

## Components

- Public institutional navbar and portal login modal
- Full-bleed generated clinic hero
- Responsive role-aware sidebar and top bar
- Compact page headings, metric panels, data tables and tab workspaces
- Explicit loading, empty, error, unauthorized and not-found states
- Staff and patient-linked student provisioning modals
- One-time credential modal with copy action and disclosure warning
- Password change, forced temporary-password change and reset pages

## Role navigation

Students see Dashboard, My health record and My appointments. Clinical staff
see Dashboard, Student patients, Appointments, ICD-11 subset and Clinic setup.
Administrators additionally see Staff management and Audit log. Backend RBAC
remains authoritative even when a navigation item is absent.

## Responsive rules

At 991 px and below, the sidebar becomes a dismissible drawer with a scrim. At
900 px and below, patient directory and workspace stack. Tables and tab rows
scroll horizontally instead of compressing labels. At 700 px and below, form
and metric grids become single-column. Buttons retain at least a 40 px target.

## Accessibility

Inputs have visible labels and validation feedback; icon-only controls have
tooltips and accessible names; keyboard focus uses a visible gold outline;
status does not rely on color alone; heading levels and landmarks are retained.
