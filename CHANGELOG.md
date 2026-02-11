# Feedback Changelog

## Issues Collected

Six issues were identified across IMPLEMENTATION_NOTES.md and VALIDATION.md.

## Issue Log

### Issue A — File Map missing config files

| | |
|---|---|
| **Source** | IMPLEMENTATION_NOTES.md, VALIDATION.md |
| **Classification** | `03-architecture` / ARCHITECTURE.md |
| **Problem** | File Map listed 8 source files but omitted `package.json`, `vite.config.js`, and `.gitignore`, all of which are required to clone and run the project. |
| **Fix** | Added all three to the File Map table. Updated count from 8 to 11. |
| **Re-run needed?** | No — implementation already has these files. |

### Issue B — Chat component interface underdocumented

| | |
|---|---|
| **Source** | VALIDATION.md (integration check) |
| **Classification** | `03-architecture` / ARCHITECTURE.md |
| **Problem** | Architecture's Component Breakdown for Chat listed props as `messages, loading, phase, onSend` but the implementation also passes `error` and `onRetry` for API failure handling. |
| **Fix** | Updated Chat's entry in Component Breakdown to include `error` and `onRetry` props. |
| **Re-run needed?** | No — implementation is already correct. |

### Issue C — Synthetic session-start message not documented

| | |
|---|---|
| **Source** | IMPLEMENTATION_NOTES.md, VALIDATION.md |
| **Classification** | `03-architecture` / ARCHITECTURE.md |
| **Problem** | Flow Diagram step 3 said "App calls `api.sendMessage([])` with empty history" but the Claude API requires at least one user message. The server silently injects `"(session start)"` — this workaround was undocumented. |
| **Fix** | Updated Flow Diagram step 3 to explicitly describe the synthetic message injection. |
| **Re-run needed?** | No — implementation is already correct. |

### Issue D — Session state model missing `error` field

| | |
|---|---|
| **Source** | VALIDATION.md (integration check) |
| **Classification** | `03-architecture` / ARCHITECTURE.md |
| **Problem** | Data Model and State Management table listed 4 state fields (`messages`, `distress`, `phase`, `loading`) but the implementation also has `error` (boolean). |
| **Fix** | Added `error` to the Session data model description and to the State Management table. |
| **Re-run needed?** | No — implementation is already correct. |

### Issue E — Technology table says "React 19 via CDN"

| | |
|---|---|
| **Source** | Code review during feedback step |
| **Classification** | `03-architecture` / ARCHITECTURE.md |
| **Problem** | Technology Decisions table said "React 19 via CDN" but the project uses React via npm + Vite bundling, not CDN script tags. |
| **Fix** | Changed to "React 19 via npm". |
| **Re-run needed?** | No — cosmetic documentation fix. |

### Issue F — No mid-session restart button

| | |
|---|---|
| **Source** | VALIDATION.md (flow test, UX step 6) |
| **Classification** | `04-implementation` (already fixed in step 05) |
| **Problem** | Spec UX Flow step 6 says "The user can start a new session at any time" but the active session view had no restart control. |
| **Fix** | Added "Start over" button (fixed top-right) to App.jsx active session view. Already applied during validation. |
| **Re-run needed?** | No — fix already in place and verified. |

## Summary of Changes

| File | Changes Made |
|------|-------------|
| `ARCHITECTURE.md` | 6 edits: fixed "CDN" → "npm", added 3 files to File Map, expanded Chat interface docs, documented synthetic message, added `error` to data model and state table |
| `src/App.jsx` | 1 edit (applied in step 05): added "Start over" button during active session |

## Re-run Assessment

All fixes are additive documentation corrections to ARCHITECTURE.md. No fix changes more than 30% of any step's output. No downstream files were invalidated — the implementation was already correct and the architecture was simply brought into alignment.

## Final Status

**COMPLETE**

No steps need re-running. Architecture now accurately documents the implementation. All 10 spec requirements, 5 edge cases, and 6 UX flow steps remain passing.
