# NABNAK security audit and hardening

Audit date: 2026-11-25. Base revision: `952dbd8ffbcdd83a7cade6dc68361bd140fa4b16`. Scope: the local checkout of `LuciusByFrost/nabnak`, all application JavaScript, HTML, CSS, SVGs, tools, dependencies, tests and locally available Git history. This is a source review with executable unit/integration checks, not a claim that every browser exploit or deployed GitHub setting was verified. No backend, authentication, analytics or production dependency was added. No push or deployment was authorized or performed.

## Architecture and threat model

NABNAK is a static, same-origin application with tasks/goals in `nabnak.data`, mind maps in independent keys, and separate preferences. Rendering uses `textContent`, DOM construction and fixed SVG element/attribute names. Text is never interpreted as markup. Translations and icon paths come from repository code, not user input. Dynamic selectors use validated calendar dates; task/node IDs are compared as values rather than interpolated into selectors. The existing three skins, Original light/dark/system behavior, PT-BR/EN/ES dictionaries, task/calendar/goal workflows and mobile controls remain.

Treat JSON files, direct import calls, clipboard/drop content, stored values and other tabs as untrusted. Attackers may persuade a user to import a file, paste rich content, or host another application on the same origin. Local attackers and malicious extensions can read/change storage. Protect application availability and data integrity, avoid interpreting untrusted markup, and prevent accidental exposure through the development server. A compromised operating system, browser, extension, or repository script remains outside the application trust boundary.

## Confirmed findings in the original source

Severity is contextual and qualitative; no CVSS score is asserted.

| Finding | Severity | Evidence and resolution |
| --- | --- | --- |
| Unbounded JSON/graph processing | Medium | `importFile` read the full file, direct `importJson` parsed arbitrary-sized text, and graph validation repeatedly searched arrays/ancestor chains. Deep/large graphs could exhaust memory or block the main thread. Added byte/count/text/depth bounds, indexed validation and cached layout spans. |
| Rich HTML clipboard/drop insertion | Medium | Node title editing enabled rich `contenteditable` with no paste/drop interception. Untrusted live markup and resource loads were possible. Added plain-text insertion with selection handling and a size gate; HTML input types are blocked. Actual script execution via native clipboard sanitization varies by browser and was not demonstrated here. |
| Import failure reported as success | Medium | `transact` swallowed failures; persistence failures only set an error while `importJson` returned true. Imported state/history could change despite failed persistence. Imports now validate the whole candidate and persist it before changing state/history; failures return false. |
| Silent stale writes | Medium | Neither content store compared the current stored snapshot before writing. A stale tab could overwrite newer work. Added snapshot checks and storage-event conflict warnings; saved data is preserved. |
| Incomplete storage validation and task migration protection | Medium | Stored task objects were only shallowly checked; malformed fields could be coerced/reset and persisted without an original task backup. Validation now runs before normalization; unreadable bytes remain untouched and valid originals are backed up before migration/write. |
| Development file disclosure and symlink following | Low–Medium | The server served arbitrary non-hidden repository files and followed symlinks. It lacked method, MIME-sniffing and Host restrictions. It now serves a snapshot of public asset names, checks canonical paths and link components, and rejects unsupported methods/hosts. Local binding limits exposure; a hostile local filesystem writer remains trusted more than an ordinary web visitor. |
| Third-party font requests | Low (privacy) | Google Fonts stylesheet/font requests disclosed visit metadata. Nunito and its complete license now ship locally. |

## Potential risks and defense in depth

No working stored-XSS or prototype-pollution exploit was confirmed in ordinary task/goal/map rendering. Existing text sinks were already safe; object spread alone is not proof of prototype pollution. Recursive rejection of `__proto__`, `prototype` and `constructor` now prevents dangerous keys from reaching retained metadata or later code.

SVG export previously escaped text and imports discarded dimensions. Injection through a normal imported file was **not confirmed**. The public export function now independently validates its map, numeric geometry, dimensions and hex colors, escapes XML metacharacters, and replaces XML-invalid control characters/unpaired surrogates only in the exported representation. Exported SVG contains no scripts, event attributes, foreign objects, links or external resources.

No matching credential patterns were found in the working tree or 87 blobs in the nine commits available locally. The custom scanner detects several common token/key formats and suspicious assignments, prints filenames/rules only, and cannot identify every possible secret. Remote branches not present locally and GitHub account settings were not audited.

## Validation and resource limits

`js/security.js` provides shared object, version, text, ID, number, count, recursive-key and bounded JSON checks. UTF-8 imports and content snapshots are limited to 2 MiB. Titles allow 500 UTF-16 code units; descriptions 10,000. Legitimate Unicode, emoji, accents and HTML-looking text remain text. IDs permit 1–128 Unicode letters/numbers, `_` and `-`, excluding dangerous key names.

Limits: 30 maps, 500 nodes/map, 1,500 edges/map, hierarchy depth 100, 10,000 tasks and 1,000 goals. Coordinates/camera offsets must be finite and within ±1,000,000; dimensions are finite and 1–50,000; zoom is .01–3; colors are six-digit hex; flags are booleans. Dates must be real Gregorian dates from 0001-01-01 through 9999-12-31. Language, mode and skin use existing explicit allowlists. EN/PT-BR/ES error messages cover validation, oversized files, unsupported versions, unsafe keys and conflicts.

Graph validation indexes nodes and undirected edge pairs. Parent references and typed tree edges must agree, roots cannot have parents, edge IDs are unique, and iterative ancestry validation rejects cycles and excessive depth. Generated missing tree edges are included in the edge limit. Legacy arrays, individual maps, v1/v2 exports, `connections`, `from/to`, `text/label`, `position` and `viewport` remain supported. Explicit invalid versions, including string/null versions, are rejected. Strict import projection accepts only known fields. Safe unknown metadata is retained only for existing stored-data migrations/edits, after bounded recursive checks; original serialized bytes remain available in backup.

Ordinary edits retain unsaved in-memory work on quota errors and display persistence errors. Import transactions instead require successful persistence before publishing state/history. This distinction is intentional. History has a count and approximate serialized-memory budget. All processing still runs on the main thread; bounded imports can briefly pause slower devices. JavaScript APIs are not a sandbox against code already executing on the origin.

## Storage, backup, recovery and privacy

`localStorage` is **not an encrypted vault**. Data is plaintext, accessible to scripts on the same origin and to local profiles/extensions. Clearing browser data, private browsing, quota exhaustion and device loss can erase it. NABNAK does not store credentials or transmit task/map content. The hosting provider can still log asset requests. Downloaded JSON/SVG and recovery files may contain private information; keep them private and securely delete unwanted copies yourself.

GitHub Pages project paths on `LuciusByFrost.github.io` share an origin with other projects on that hostname. Paths are not storage isolation boundaries. A dedicated origin/custom domain reduces this shared-origin risk; CSP does not prevent a malicious same-origin application from accessing these keys.

Unreadable/newer/unsafe stored content is not overwritten. Tasks operate in memory with a warning; unreadable maps are read-only and their existing raw export remains available. A `.backup` key retains exact original bytes before the first write to existing content; existing backups are never overwritten automatically. Legacy map source keys stay intact. Oversized/invalid older data is preserved for manual recovery instead of silently truncated.

The existing sidebar contains a collapsed **Privacy and recovery** section with translated controls:

1. **Download recovery backup** saves a `nabnak-recovery` version 1 envelope with exact owned key values. On quota/conflict errors it also includes valid unsaved task/map snapshots. These snapshots take precedence when the file is restored; original bytes are retained in the envelope and, when possible, a backup key.
2. **Restore recovery backup** checks the file size (24 MiB), envelope, keys, preferences and primary content schemas before asking for replacement confirmation. Only keys included in the file are replaced. Invalid raw primary data is downloadable for manual repair but cannot be automatically loaded. Backup-key strings may remain unreadable, because they are recovery material rather than active data. Successful restore reloads the page.
3. **Clear NABNAK data** asks for explicit confirmation and removes only a fixed list of content, legacy, backup and preference keys, then reloads. It never calls `localStorage.clear()` and leaves unrelated origin data alone.

Download a current backup before restoring or clearing. Do not edit in other tabs during recovery. localStorage cannot provide a multi-key transaction: restore retains previous values and attempts rollback after a write failure, but rollback can also fail if the browser/storage becomes unavailable. The UI reports this limitation rather than success. Recovery files larger than the supported envelope size require manual offline extraction/repair. A recovery file is not signed; validation checks shape and safety, not authorship.

Cross-tab content writes compare serialized snapshots and listen for storage events. Conflicts retain saved data and warn users to export unsaved work and reload. Preferences remain last-write-wins. This is optimistic conflict detection, not an atomic compare-and-swap: simultaneous writes between check and set can still race because localStorage has no transaction/locking primitive. No claim of complete cross-tab consistency is made.

## CSP and GitHub Pages

The CSP meta element appears after charset and before any script/style declaration. It sets `default-src 'self'`, `script-src 'self'`, `script-src-attr 'none'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-src 'none'` and `worker-src 'none'`. It allows local fonts/styles/images and `data:` images for the existing fixed SVG theme textures. Stylesheets must be local. `style-src-attr 'unsafe-inline'` supports existing dynamic map positioning/camera transforms, CSS variables and sidebar scene sizing; it grants no inline script or eval permission. Modern CSP3 support is required for this style distinction. There is no `unsafe-inline` or `unsafe-eval` in script policy. Blob URLs are created only for downloads and revoked; no unnecessary blob script/image allowance was added.

GitHub Pages does not offer repository-configurable arbitrary HTTP response headers. Do not represent `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, HSTS, COOP/COEP or CSP `frame-ancestors` as working HTML meta settings. CSP `frame-ancestors`, `sandbox` and reporting directives are not supported through the CSP meta delivery used here. Therefore anti-framing, HTTP-only headers and CSP violation reporting require a host/proxy that supports response headers. The development server supplies applicable response headers, including `frame-ancestors 'none'`; those headers do not transfer automatically to Pages. A referrer meta policy is supported and included. Meta CSP applies only after it is parsed and cannot protect unrelated documents on the origin.

References: [W3C CSP delivery and meta restrictions](https://www.w3.org/TR/CSP3/#meta-element), [MDN CSP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy).

## Development server

`tools/serve.cjs` binds only to 127.0.0.1 and accepts GET/HEAD with expected localhost Host headers. Encoded traversal, backslashes, NULs, dot segments, non-public paths and symbolic links/junctions are rejected. Public names are snapshotted from `index.html`, `js`, `css`, `icons` and `assets`, restricted to known web MIME types. Development files, tests, manifests, docs, dotfiles and dependencies are not public. Responses have no-store, correct MIME, nosniff, referrer, permissions, anti-framing and CSP headers.

The server is a development helper. Canonical-path/component checks substantially reduce link escapes but do not promise protection against a privileged local attacker racing filesystem changes between checks/open. Do not run it on an untrusted writable checkout or expose it through a public tunnel. These checks preserve the existing Playwright `startServer` API.

## Repository automation and manual settings

Dependabot monitors npm and Actions weekly. CI runs dependency audit, unit/regression tests, pattern-based working-tree/history secret checks, Chromium/Firefox/WebKit security tests, existing browser/theme suites and whitespace checks. CodeQL analyzes JavaScript with extended security queries. Workflows use read-only contents access, disable persisted checkout credentials, have job timeouts, avoid `pull_request_target`, and grant `security-events: write` only to the CodeQL job. Actions are pinned to full commit SHAs verified against their GitHub release/commit pages: [checkout v7.0.1](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1), [setup-node v7.1.0](https://github.com/actions/setup-node/commit/949feb2413d6458794dcd2491c4babbbce0c15c1) and [CodeQL v4.39.5](https://github.com/github/codeql-action/commit/915412ff23e8b7659517e607487dbeae018f2934). Dependabot should keep these pins current; a verified commit is not a promise of vulnerability-free code.

Maintainers should manually enable private vulnerability reporting, secret scanning and push protection, Dependabot alerts/security updates, and branch protection/rulesets requiring review and successful security checks. Require approval for external contributor workflows and restrict allowed Actions. Review Pages source to publish public assets only; the development-server allowlist does not control Pages publication. CodeQL needs code-scanning eligibility and appropriate token settings: [GitHub documents availability](https://docs.github.com/en/code-security/concepts/code-scanning/code-scanning). None of these account settings were changed. Workflows are prepared locally and have not run on GitHub.

`.gitignore` protects environment files, common private key formats, local package credentials, cloud/SSH directories, recovery exports, logs, temporary backups, browser artifacts and coverage outputs. Ignore rules do not remove already committed secrets: rotate any future confirmed exposure and coordinate history remediation separately. No `npm audit fix --force` was used.

## Files modified

- Application: `index.html`, `js/security.js`, `js/security-translations.js`, `js/store.js`, `js/mindmap-data.js`, `js/mindmap.js`, `js/script.js`, `js/i18n.js`, `js/recovery.js`, `js/recovery-ui.js`.
- Appearance assets: `css/fonts.css`, `css/theme-picker.css`, `assets/fonts/Nunito.ttf`, `assets/fonts/OFL.txt`, `assets/fonts/README.md`. Existing theme tokens, illustrations and scene assets were not replaced.
- Tooling/configuration: `tools/serve.cjs`, `tools/scan-secrets.cjs`, `package.json`, `.gitignore`, `.github/dependabot.yml`, `.github/workflows/security.yml`.
- Verification/documentation: `tests/security.test.cjs`, `tests/browser/security.cjs`, `SECURITY.md`, `README.md`, `docs/SECURITY.md`.

## Executed verification

Browser results must not be inferred from the DOM harness or from configured CI.

| Check | Actual local result |
| --- | --- |
| `npm ci` | Completed through `npm.cmd ci`: 2 packages installed, reported 0 vulnerabilities. PowerShell blocked the `npm.ps1` shim, so the Windows `.cmd` launcher was used. |
| `npm test` | 131 tests passed, including all 113 existing tests and 18 added security tests. |
| `npm run test:browser` | Blocked at Chromium launch: `spawn EPERM`; no visual/browser assertions ran. |
| `npm run test:themes` | Blocked at Chromium launch: `spawn EPERM`; no screenshot/theme assertions ran. |
| `npm run test:security:browser` | Chromium launch blocked (`spawn EPERM`); Firefox and WebKit executables absent. Report has no executed browser checks; not passed. |
| `npm audit` | Exit 0, reported 0 vulnerabilities (including development dependencies). The environment restricts network access and uses its configured registry/cache; freshness of advisory data was not independently verified. |
| Secret scan | Working tree: no matching patterns. Node-spawned full-history scan hit EPERM; equivalent shell enumeration and the same matching rules scanned 87 blobs from nine locally available commits with zero matches. |
| `git diff --check` | Passed at the verification point; repeated after documentation/commits. |

Added tests cover recursive dangerous keys/prototype safety, UTF-8 size and nesting bounds, version rejection, Unicode preservation, text/date/reference validation, invalid IDs/cycles/tree inconsistencies, numeric/color/dimension bounds, import field projection, quota/atomicity/history preservation, stale writes, migration backups, corrupted storage, inert text/SVG output, recovery validation/rollback/owned-key clearing, server traversal/Host/method/MIME/link defenses. Real symlink/junction checks executed successfully in the unit suite. New Playwright tests additionally exercise clipboard events, file-picker size checks, exported SVG documents, runtime CSP rejection and external-request absence, but their assertions remain unexecuted locally because of the launch restriction.

Remaining acceptance work: run all browser suites in an environment with browser process permission and installed engines; review rendered typography/sidebar controls across all themes and viewports; run the configured GitHub workflow; review CodeQL and fresh advisory results; enable the manual GitHub settings above. Automated browser coverage and human visual confirmation remain necessary before claiming fully verified UI equivalence.
