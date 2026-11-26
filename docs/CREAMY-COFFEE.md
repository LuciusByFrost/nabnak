# Lo-fi Café — Creamy Coffee / Café Cremoso

Refinement date: 2026-11-25. This change affects only selectors matching `:root[data-skin="lofi-cafe"]`. It changes colors and interaction transitions, preserving component positions, spacing, corners, typography, responsive rules and the illustration toggle. No JavaScript, translation, security, CSP, storage or dependency change is included. Changes are left uncommitted and have not been pushed.

## Final color tokens

| CSS variable | Value | Purpose |
| --- | --- | --- |
| `--bg` | `#F5EBDD` | Cream-paper page/canvas background |
| `--surface` | `#F1E5D5` | Cards, inputs, dialogs and editing surfaces |
| `--sidebar` | `#E7D5C2` | Sidebar |
| `--surface-soft` | `#EADCCA` | Kanban columns and secondary surfaces |
| `--surface-hover` | `#E3CBB4` | Secondary hover surfaces |
| `--border` | `#D5BFA9` | Subtle decorative separation |
| `--control-border` | `#8D6B50` | Identifiable input/control boundaries |
| `--text` | `#5A4434` | Primary coffee-brown text |
| `--text-secondary` | `#745E4D` | Subtitle and goal description text |
| `--muted` | `#6B5443` | Small labels/placeholders, including darker selected/sidebar surfaces |
| `--scroll-thumb` | `#8A7463` | Muted reference shade used for scrollbar thumbs |
| `--accent-solid` | `#C98D63` | Primary buttons |
| `--accent-hover` | `#B67B56` | Primary-button hover |
| `--accent-ink` | `#2C1E14` | Accessible primary-button text |
| `--accent` | `#71482F` | Action text, active indicators and primary-button borders |
| `--accent-soft` | `#E3CBB4` | Selected items and text selection |
| `--focus` | `#71482F` | Existing visible keyboard focus outlines |
| `--success-soft` | `#D5DFC9` | Success background |
| `--success` | `#405A38` | Success text |
| `--positive-fill` | `#647A57` | Progress fill, retained |
| `--sage` | `#829477` | Decorative completed-goal accent, retained |
| `--danger` | `#8B4037` | Error/destructive text, darkened for contrast |
| `--danger-soft` | `#EAD4C7` | Warm error badges and storage notices |
| `--warning` | `#705025` | Due-today/warning text |
| `--warning-soft` | `#EBDDC3` | Due-today/warning background |

Warm shadows: `--shadow: 0 5px 16px #5A443416`; `--card-shadow: 0 2px 5px #5A443410, inset 0 1px 0 #F5EBDD80`. The previous white card highlight is replaced by cream. The canvas dot pattern uses `#D5BFA9`. Existing paper texture, asymmetric Café card corners, illustration URLs, scene opacity and scene sizing remain unchanged. Opaque warm component surfaces keep text readable over the existing scene without modifying its image or adding a new overlay.

## Component coverage

Existing semantic variables recolor the sidebar/navigation, task creation and its disclosures, Kanban columns/cards, filters/search, quick inputs, calendar, goals/progress, mind maps/inspector/toolbars, editor dialogs, privacy/recovery controls and theme panel. Café-only overrides cover remaining control borders, placeholders/options, hover states, editable-title focus, status badges, notices, scrims, Café preview and scrollbars. New field/summary transitions use the existing 140 ms timing and are enabled only when reduced motion is not requested. Existing button transitions and focus outlines remain intact.

User-authored mind-map node colors are preserved. Original and Midnight preview swatches continue to represent their own identities. Browser-native confirmation dialogs, title tooltips and native picker internals are controlled by the browser/OS and cannot be fully recolored with application CSS; they are not replaced. The task date disclosure now explicitly requests the Café light color scheme instead of inheriting an earlier hardcoded dark native-control rule.

## Accessibility checks

The proposed `#8A7463` muted text and `#A4554B` error text did not meet 4.5:1 on all relevant warm surfaces. Their readable roles therefore use darker coffee/terracotta variants. Primary-button ink is also darkened so the requested hover background remains readable. Decorative borders remain subtle; functional control boundaries use the stronger separate token.

Existing contrast assertions were retained and expanded for Café hover/selected surfaces, sidebar/control boundaries, secondary text and scrollbars. Static sRGB checks found:

- Minimum text contrast across the checked neutral/selected surface role combinations: **4.53:1**.
- Primary-button hover text contrast: **4.57:1**.
- Minimum checked control-boundary contrast: **3.09:1**.
- Existing focus-token checks meet **3:1** or greater; normal text checks meet **4.5:1** or greater.

These are token-level results, not a claim of full WCAG conformance or rendered pixel validation. Native widgets, user-chosen map colors and the illustration's composed pixels need browser inspection.

## Actual validation results

| Command/check | Result |
| --- | --- |
| `npm test` | Exit 0: **138 passed, 0 failed, 0 skipped**, including expanded contrast and existing security regressions. |
| `npm run test:browser` | Exit 1: Chromium launch blocked by `spawn EPERM`; no rendered desktop/mobile checks ran. |
| `npm run test:themes` | Exit 1: Chromium launch blocked by `spawn EPERM`; no new screenshots or visual comparisons ran. The before-change attempt was blocked too. |
| `npm run test:security:browser` | Exit 1: Chromium launch blocked by `spawn EPERM`; Firefox and WebKit executables unavailable. No browser security assertions ran. |
| `git diff --check` | Exit 0; no whitespace errors. |
| Source isolation | Existing rules outside the Café token block compare equal to HEAD after newline normalization; every added override is Café-scoped. Original/Midnight definitions, shared styles, assets and security modules are unchanged. |

Command output is retained in ignored `artifacts/creamy-coffee-*` files. Pre-existing screenshots are not presented as current before/after evidence. No existing assertion was disabled or weakened. Rendered desktop/mobile appearance, native controls and pixel equivalence remain pending an environment that permits browser launch.

Modified files: `css/themes.css`, `tests/contrast.test.cjs` and this document.
