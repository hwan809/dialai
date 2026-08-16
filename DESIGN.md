# DialAI Design System

## 0. Research Log

- Primary reference: `/Users/shanks/Downloads/디자인.md` supplied by the user. It defines the product tone, four-screen flow, palette, typography, status language, responsive priorities, and MVP scope.
- Embedded reference: the supplied design direction is the visual contract. `taste-skill.md` is used only for form, interaction-state, and anti-slop discipline; `layout-skill.md` is used for the live-call scroll shell.
- Skipped lanes: external screen research and generated mockups were unnecessary because the user supplied a concrete product-specific reference and asked for direct implementation.
- Conversational redesign reference: the user supplied a Wrtn desktop screenshot and `/Users/shanks/Downloads/DESIGN.md`. The screenshot defines the fixed sidebar, quiet top bar, centered empty-chat prompt, large bottom composer, and compact suggestion actions. The document supplies the warm off-white canvas, ink CTA, hairlines, pill geometry, and atmospheric pastel orbs. DialAI keeps its own name, iconography, and phone-work copy.

## 1. Atmosphere & Identity

DialAI feels like a calm, accountable operations desk. The signature is a clear blue progress rail paired with quiet white work surfaces: users always see what the agent is doing, what needs their attention, and what happened next. The visual language is restrained, practical, and human. It never uses robot imagery, neon, large gradients, decorative voice waves, or playful copy.

Design dials: variance 3, motion 2, density 5. The interface is predictable, nearly static, and information-forward.

## 2. Color

### Palette

| Role | Token | Value | Usage |
|---|---|---|---|
| Background | `--color-background` | `#F7F8FA` | Page and shell background |
| Surface | `--color-surface` | `#FFFFFF` | Forms, summaries, transcript panels |
| Surface subtle | `--color-surface-subtle` | `#FCFCFD` | Read-only rows and secondary groups |
| Primary | `--color-primary` | `#3157D5` | One primary CTA and current progress |
| Primary hover | `--color-primary-hover` | `#2948B5` | Primary hover and pressed state |
| Primary soft | `--color-primary-soft` | `#EDF2FF` | Informational status and selected controls |
| Text primary | `--color-text-primary` | `#171A21` | Headings and body |
| Text secondary | `--color-text-secondary` | `#667085` | Supporting copy and metadata |
| Text tertiary | `--color-text-tertiary` | `#98A2B3` | Placeholder and disabled content |
| Border | `--color-border` | `#E4E7EC` | Default outlines and dividers |
| Border strong | `--color-border-strong` | `#D0D5DD` | Interactive control outlines |
| Success | `--color-success` | `#16845B` | Active conversation and completion |
| Success soft | `--color-success-soft` | `#ECF8F2` | Completion surface |
| Warning | `--color-warning` | `#C47A08` | Waiting and user confirmation |
| Warning soft | `--color-warning-soft` | `#FFF7E8` | Attention surface |
| Error | `--color-error` | `#D64545` | Failure and destructive feedback |
| Error soft | `--color-error-soft` | `#FFF0F0` | Error surface |
| Focus ring | `--color-focus-ring` | `#8EA6F4` | Keyboard focus halo |

### Rules

- Primary blue appears only on the current state, selected controls, links, and the single primary CTA.
- Status colors are always paired with explicit text and, where appropriate, an icon.
- This MVP is a locked light-theme product surface, matching the supplied design contract.
- New colors must be documented here before use.

## 3. Typography

### Font stack

- Primary: `"Pretendard Variable", Pretendard, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Numeric metadata: the same primary family with tabular numerals.

### Scale

| Level | Token | Size | Weight | Line height | Usage |
|---|---|---|---|---|---|
| Page title | `--text-title` | `clamp(1.5rem, 4vw, 1.75rem)` | 700 | 1.3 | Screen heading |
| Section title | `--text-section` | `1.125rem` | 650 | 1.45 | Card and panel headings |
| Body | `--text-body` | `1rem` | 400 | 1.6 | Default copy and controls |
| Body small | `--text-small` | `0.875rem` | 400 | 1.5 | Helper text and metadata |
| Caption | `--text-caption` | `0.75rem` | 600 | 1.4 | Status and compact labels |

### Rules

- Body text is never smaller than 14px.
- Titles use weight and spacing, not oversized scale, to establish priority.
- Korean copy uses plain language and makes completion, failure, and next action explicit.

## 4. Spacing & Layout

### Base unit

All intent spacing derives from 4px.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Icon-to-label |
| `--space-2` | `8px` | Tight groups |
| `--space-3` | `12px` | Compact control spacing |
| `--space-4` | `16px` | Standard gaps and mobile card padding |
| `--space-5` | `20px` | Comfortable groups |
| `--space-6` | `24px` | Desktop card padding |
| `--space-8` | `32px` | Section groups |
| `--space-10` | `40px` | Major screen rhythm |
| `--space-12` | `48px` | Page top and bottom spacing |
| `--space-16` | `64px` | Wide-screen outer spacing |

### Grid and shell

- Primary content width: `760px`; live-call content width: `960px`.
- Page gutter: `16px` mobile, `24px` tablet, `32px` desktop.
- Breakpoints: `sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`.
- Multi-column forms collapse to one column below 640px.
- The live-call page uses a bounded `100dvb` shell. The transcript body is the only vertical scroll owner; the status header and action dock remain visible.
- At 375px all primary content reflows to one column with no horizontal scrolling.

## 5. Components

### App Header

- **Structure**: brand mark and name, current flow label, optional demo badge.
- **States**: static; the demo badge is informational, never interactive.
- **Accessibility**: brand is plain text; no decorative image dependency.
- **Layout**: cluster inside the page content limiter.

### Button

- **Variants**: primary, secondary, quiet, destructive.
- **Spacing**: `--space-3` inline controls, minimum 46px height.
- **States**: default, hover, active, focus-visible, disabled, loading.
- **Accessibility**: visible focus ring, disabled semantics, labels never wrap on desktop.
- **Motion**: 120ms transform and color feedback; reduced-motion removes transform.

### Icon Button

- **Structure**: square button with one line icon and accessible label.
- **Variants**: neutral, listening.
- **States**: default, hover, active, focus-visible, disabled, pressed.
- **Accessibility**: minimum 46px hit target and `aria-pressed` for listening.

### Field

- **Structure**: visible label, control, helper or error below.
- **Variants**: input, textarea, number, datetime.
- **States**: default, hover, focus, disabled, error.
- **Accessibility**: no placeholder-only labels; errors use `role="alert"` when submitted.
- **Layout**: stack with `--space-2`.

### Surface

- **Variants**: default work surface, subtle read-only group, status success/warning/error.
- **Spacing**: `--space-4` mobile and `--space-6` desktop.
- **States**: static, interactive disclosure where explicitly used.
- **Accessibility**: semantic section headings and sufficient contrast.

### Status Badge

- **Variants**: neutral, info, warning, success, error.
- **States**: status text is always visible; color never carries meaning alone.
- **Accessibility**: concise Korean status labels and optional `aria-live` on the parent region.

### Progress Rail

- **Structure**: ordered list of named phone stages with completed, current, and upcoming treatments.
- **States**: completed, current, upcoming; the named sequence includes request check, dialing, ARS, counselor waiting, and conversation.
- **Accessibility**: ordered semantics and `aria-current="step"` on the current stage.
- **Layout**: horizontal on wide screens; compact two-column or stacked list on mobile.

### Transcript Item

- **Structure**: speaker label, timestamp, message body.
- **Variants**: agent and call recipient.
- **States**: empty transcript uses a useful explanatory message.
- **Accessibility**: transcript list uses `aria-live="polite"`; messages preserve reading order.

### Result Summary

- **Structure**: result status, key outcome, details, then transcript disclosure.
- **Variants**: confirmed, unavailable, needs-human, failed, canceled.
- **Accessibility**: the result is stated in text before any status color.

### Choice Question

- **Structure**: a clear question, short context, and large mutually exclusive option buttons.
- **Variants**: standard pre-call clarification and warning live-call confirmation.
- **States**: unselected, selected, focus-visible, disabled, submitting.
- **Accessibility**: semantic `fieldset` and `legend`; selected state uses `aria-pressed` and text in addition to color.
- **Layout**: options wrap on desktop and stack into full-width controls on mobile; live-call questions stay in the action dock above the transcript controls.

### Primitive Showcase

- **Route**: `/design-system` in development and production builds for designer handoff.
- **Coverage**: buttons, fields, status badges, progress states, surfaces, transcript states, and empty/error examples at responsive widths.

## 6. Motion & Interaction

| Type | Token | Duration | Easing | Usage |
|---|---|---|---|---|
| Micro | `--duration-micro` | `120ms` | ease-out | Hover, press, focus feedback |
| Standard | `--duration-standard` | `220ms` | ease-in-out | Disclosure and state transition |

- Motion only communicates interaction feedback or a state change.
- Only opacity and transform are animated.
- `prefers-reduced-motion: reduce` disables non-essential transforms and transitions.
- There are no decorative loops, wave animations, or scroll effects.

## 7. Depth & Surface

Strategy: mixed, with borders as the primary separator and one subtle tinted shadow on primary work surfaces.

| Token | Value | Usage |
|---|---|---|
| `--shadow-surface` | `0 1px 2px rgb(23 26 33 / 0.03), 0 10px 32px rgb(49 87 213 / 0.05)` | Main work surface |
| `--shadow-dock` | `0 -8px 24px rgb(23 26 33 / 0.06)` | Fixed live-call action dock |
| `--radius-control` | `10px` | Inputs and buttons |
| `--radius-surface` | `12px` | Cards and panels |

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG 2.2 AA target: 4.5:1 body contrast, 3:1 large text and component boundaries.
- Every control is keyboard reachable and has a visible focus state.
- Touch targets are at least 44px; primary buttons are 46-48px high.
- Screen state and validation are announced through semantic regions and `aria-live` where useful.
- The layout supports 200 percent zoom, long Korean labels, unbroken phone numbers, and reduced motion.
- The primary user journey must be completable with keyboard only.

### Inclusive personas

- A mobile user calling while moving needs large controls and the current state before transcript detail.
- A low-vision user needs strong contrast, clear focus, and text status in addition to color.
- An anxious user delegating a sensitive task needs explicit confirmation, reversible navigation before calling, and unambiguous results.

### Accepted debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Browser speech recognition support varies by browser | Request screen microphone control | The frontend MVP uses the browser capability and retains complete text entry as the fallback | Replace with the server transcription path when the voice backend contract is available |

## 9. Conversational App Shell

### Direction

The primary request experience is a conversation, not a long form. Desktop uses a 248px navigation rail and a flexible conversation canvas. Mobile hides the rail and exposes the brand in the top bar. The memorable moment is the oversized, softly elevated composer floating over a quiet off-white canvas with restrained mint and peach atmospheric blooms.

### Token overrides

| Role | Token | Value |
|---|---|---|
| Canvas | `--color-background` | `#F5F5F3` |
| Sidebar | `--color-sidebar` | `#FAFAF8` |
| Ink | `--color-text-primary` | `#0C0A09` |
| Body | `--color-text-secondary` | `#57534E` |
| Muted | `--color-text-tertiary` | `#A8A29E` |
| Primary | `--color-primary` | `#292524` |
| Primary hover | `--color-primary-hover` | `#0C0A09` |
| Selected | `--color-primary-soft` | `#F0EFED` |
| Hairline | `--color-border` | `#E7E5E4` |
| Hairline strong | `--color-border-strong` | `#D6D3D1` |
| Atmospheric mint | `--color-orb-mint` | `#A7E5D3` |
| Atmospheric peach | `--color-orb-peach` | `#F4C5A8` |

### New primitives

- **Navigation rail**: brand lockup, one dark pill “새 전화” action, primary navigation, and recent-call history. It is present at 768px and wider, absent below 768px.
- **Conversation canvas**: one bounded reading column inside a full-height scroll owner. Empty state centers the welcome prompt; active state aligns user messages right and DialAI messages left.
- **Chat composer**: a white 1px hairline surface with 24px radius, minimum 132px height, multiline input, microphone action, and circular ink send action. Focus is expressed by border and a soft shadow, never a saturated ring.
- **Suggestion pill**: a compact outline pill that seeds a complete phone request. It wraps and remains at least 44px high on mobile.
- **Assistant task card**: a white conversational surface embedded under an assistant message. It gathers structured call details without returning to a page-form visual hierarchy.

### Responsive and scroll ownership

- Desktop: `248px minmax(0, 1fr)` application grid; the conversation canvas owns vertical scrolling.
- Tablet: 208px rail and tighter outer gutters.
- Mobile: one-column shell, 56px top bar, composer and suggestion pills use the full available width, and user bubbles cap at 88 percent.
- Live-call status and action dock keep their existing bounded `100dvb` behavior inside the main application column.

## 10. Public Landing Page

### Purpose and order

The `/` route explains the product before asking a visitor to enter the app. Content follows the decision path: promise, show the delegated-call interaction, explain the three-step workflow, clarify user control, disclose the current restaurant-reservation MVP scope, then convert to `/call`.

### Landing primitives

- **Marketing navigation**: 64px transparent-on-canvas header with DialAI lockup, anchor links, and one ink-pill CTA. On mobile, secondary anchors are hidden while the CTA remains visible.
- **Hero band**: two-column editorial composition at desktop and one column on mobile. The left side carries one short promise and two actions; the right side shows a live DOM conversation preview over mint and peach atmospheric blooms.
- **Conversation preview**: layered white phone-work surface containing a user request, DialAI response, status pill, and small named call stages. It is demonstrative only and never imitates a real completed call.
- **Process row**: three numbered steps with hairline separation rather than three floating generic feature cards.
- **Control panel**: split section pairing concise copy with a live confirmation question that uses the same option anatomy as the product.
- **Scope note**: explicit warm-neutral disclosure that the current executable demo supports restaurant reservation calls.
- **Closing CTA**: centered editorial statement with one primary pill linking to `/call`.

### Landing responsive behavior

- Content caps at 1200px with 16px mobile, 24px tablet, and 32px desktop gutters.
- Hero changes from a 1.05fr/0.95fr split to a single column below 900px.
- Hero display text uses `clamp(2.5rem, 6vw, 4.75rem)` with Korean-safe wrapping.
- Process steps stack below 700px; navigation anchors hide below 768px.
