# 3. UI/UX & 3D Landing Page Specification

## Design principles (HCI)

| Principle | Applied as |
|---|---|
| Visual hierarchy | One H1 per screen; primary action is the only filled indigo button; secondary = outline |
| Low cognitive load | Role-specific navigation (student: 2 items, company: 1); one task per screen; progressive disclosure (evaluation opens only when attachment is *Completed*) |
| Recognition over recall | Status badges with text (never colour alone); labelled icons; field hints under inputs |
| Accessibility | Contrast ≥ 4.5:1 (tokens in `globals.css`); visible focus ring; skip link; semantic landmarks; `aria-live` for chat, voice preview and results; radio groups for scores; `prefers-reduced-motion` honoured |
| Touch targets | ≥ 44×44 px everywhere (`.btn`, score buttons, mic 48 px); mobile controls ≥ 48 px |
| Feedback | Inline field errors (same zod schemas as server), skeleton loaders, empty states with a next action, message delivery states *Sent / Delivered / Read* |
| Error prevention | Confirm dialogs for accept, reject, withdraw, complete and **final evaluation submit** (explains irreversibility); Submit disabled until the form is valid |
| Forgiveness | Failed sends keep the text; voice text lands in an editable box; upload errors name the rule that failed |

## Visual system
Indigo `#4338ca` (brand), teal `#0d9488` (students), amber `#d97706` (companies), night `#0b1020` (hero). System font stack (no font download on the critical path). Radius 14 px, soft shadow. Dark hero for 3D contrast; app screens light.

## 3D landing page
- **Concept:** a dotted globe ("where you are") with glowing arcs from teal student nodes to amber company nodes; small white packets travel along the arcs ("connection").
- **Layout:** headline + two CTAs on the left (solid dark background, white text — readable regardless of canvas); canvas on the right (stacked below on mobile, 340 px high). The canvas is `aria-hidden` with a text alternative on the wrapper.
- **Performance budget:** ~1,100 points + 4 line arcs + ~12 small meshes, no textures or models. `HeroVisual` waits for first paint + `requestIdleCallback`, then dynamic-imports three/R3F (code-split). `dpr` capped at 1.5, `powerPreference: low-power`, render loop paused when off-screen (IntersectionObserver) or tab hidden.
- **Fallbacks:** reduced motion → static frame; no WebGL or Save-Data → CSS gradient sphere.
- **Interaction:** slow auto-rotate, pointer parallax; never captures scroll (`touch-action: pan-y`).

## User flows

**Student**
1. Landing → *I'm a student* → register (name, email, password, institution, program, level) → `/student`.
2. Discover: *Use my current location* (permission prompt → on denial, message + place search + tap/drag pin) → results sorted by distance, filtered by radius/skills/text → marker preview → *View & apply*.
3. Apply: company overview, address + digital address, phone, socials, gallery; form shows only the requirements this vacancy configured; uploads intro letter (+ CV/ID if required) → confirm dialog → submit.
4. Application workspace: status badge, chat (type or dictate), evaluation panel.
5. After HR marks **Completed**: upload evaluation form → *Send form to HR* → waits → sees the sealed, read-only result.

**Company / HR**
1. Register (company + contact) → complete company profile (overview, sector, culture, photos, address, digital address, phone, map pin, socials) → add departments with exact slot counts and skills → publish vacancies with applicant requirements. *(API ready; forms are the next UI task — wizard layout below.)*
2. Applications list → open application: read letter/CV, chat, move through statuses (confirm on accept/reject/complete).
3. After completion: open the student's form, rate 5 criteria, remarks, recommendation, optional signed copy → *Review & submit…* → irreversible-action dialog → locked.

**Company onboarding wizard (to build)** — 4 steps with save-per-step and a progress header: 1 Overview & photos · 2 Location (map pin + digital address + phone) · 3 Socials · 4 Departments & slots. Vacancy form: department, title, slots (shows remaining department slots), skills (chips), requirement toggles, availability dates.

## Google Maps UX
- Primary button *📍 Use my current location* → browser/OS permission → blue draggable pin.
- Denied/unavailable: inline info message that explains the alternatives; **place search** (Geocoding) and **tap-to-drop pin** always available.
- Radius select (10–200 km); server returns distance; amber markers for vacancies; clicking a marker or list card selects both and opens an info window (title, company, slots, distance, *View & apply*).
- Mobile: Map/List tabs (one pane at a time); desktop: list left, sticky map right.
- Missing API key: banner, list still works.

## Talk-to-text chat UX
```
┌─────────────────────────────────────────────┐
│ messages (role=log, aria-live=polite)       │
│            ┌──────────────┐                 │
│            │ Hi, I applied│ 10:02 · Read    │
│ ┌──────────┴─┐                              │
│ │ Welcome!   │                              │
│ └────────────┘                              │
├─────────────────────────────────────────────┤
│ 🎙 …and I can start on the fifth  (live)    │
│ [ textarea: editable text            ] 🎙 Send│
│ Enter to send · Shift+Enter new line        │
└─────────────────────────────────────────────┘
```
States: **idle** (🎙) → **requesting** (permission prompt, button disabled, status text) → **listening** (red pulsing ■, live interim preview) → finished phrases are appended to the textarea → user edits → Send. Errors map to plain language (blocked mic, no mic, no speech heard, offline). Unsupported browsers hide the mic and keep typing. Sending is never automatic.

## Screens inventory
Landing · Sign in · Register (role tabs) · Student: Discover, Apply, My applications, Application workspace · Company: Applications, Application workspace · (to build) Company profile wizard, Vacancy editor, Student profile editor.
