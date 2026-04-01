# Recent Changes — CertFlow

## 1. Certificate Studio — Full UI Redesign

The `EventDetail.tsx` page was completely rewritten from a flat, all-sections-visible layout into a guided 5-step SaaS workflow.

### New step flow
1. Mode Selection (Single / Bulk Entry / CSV Upload)
2. Template & Branding
3. Recipient Details
4. Authority
5. Confirm & Generate → Success State

### New files created under `frontend/src/pages/studio/`

| File | Purpose |
|---|---|
| `types.ts` | All TypeScript types: `StudioState`, `StudioAction`, `PreviewData`, `Mode`, etc. |
| `studioReducer.ts` | `useReducer`-based state machine handling all 12 action types |
| `useStudioReducer.ts` | Hook wrapping the reducer with typed `state` and `dispatch` |
| `utils.ts` | `parseBulkLine`, `parseBulkText`, `parseCsv`, `validateStep`, `EMAIL_REGEX` |
| `StepIndicator.tsx` | "Step N of M — Label" with clickable backward-navigation dots |
| `StepContainer.tsx` | Consistent panel wrapper with `animate-slideUp` |
| `FormSection.tsx` | Reusable grouped section with title + optional subtitle |
| `InlineValidator.tsx` | Field-level inline error message component |
| `PrimaryButton.tsx` | Single teal CTA button with loading spinner |
| `ProgressBar.tsx` | Bulk/CSV generation progress bar with success/failed counts |
| `ModeSelector.tsx` | 3-card mode picker (Single / Bulk / CSV) |
| `BrandingStep.tsx` | Template visual grid + logo upload + LogoPositioner + signature upload |
| `RecipientStep/SingleForm.tsx` | Grouped Recipient Info + Event Info form with inline validation |
| `RecipientStep/BulkEntryForm.tsx` | Textarea with live per-line parse validation |
| `RecipientStep/CsvUploadForm.tsx` | CSV file upload with client-side parse + row-level error table |
| `RecipientStep/index.tsx` | Switches between the 3 sub-forms based on active mode |
| `AuthorityStep.tsx` | Authority name/position inputs + signature upload |
| `ConfirmationStep.tsx` | Read-only summary table with edit links + generate CTA |
| `SuccessState.tsx` | Post-generation state with Download, Send Email, Verify, Generate Another |
| `CertPreview.tsx` | Live certificate preview card using Playfair Display font |
| `FieldChecklist.tsx` | Status checklist below preview (Template, Recipient, Authority, QR, Hash) |
| `PreviewPanel.tsx` | Sticky right-column panel with live preview + full-screen modal |

### Key UX improvements
- 2-column layout: scrollable form left, sticky live preview right
- Preview debounces 300ms and updates on every keystroke
- Mode switching resets all mode-specific form state
- Inline validation blocks step advance on required fields
- Confirmation step shows full summary before generation
- Progress bar during bulk/CSV generation
- Success state with clear delivery actions

---

## 2. Template Selector — Visual Grid

Replaced the plain `<select>` dropdown in `BrandingStep` with a visual grid of color-swatch cards. Each card shows:
- Template background color
- Title color dot + accent color dot
- Template name
- Active state: teal border + checkmark badge

Removed the duplicate hardcoded `ai-generated` option (it's already injected by `EventDetail` on mount).

---

## 3. Tailwind Design Tokens

Extended `frontend/tailwind.config.js` with:
- `fontFamily.ui` — Inter, Manrope, system-ui
- `fontFamily.cert` — Playfair Display, Cormorant Garamond, Georgia
- `colors.success` — green-600 / green-100
- `colors.warning` — yellow-600 / yellow-100
- `colors.error` — red-600 / red-100
- `colors.studio.*` — bg, panel, border, heading, label, muted (slate scale)

---

## 4. Font Imports

`frontend/src/index.css` updated to import Inter (400–700) and Playfair Display (400–700) from Google Fonts, replacing the previous DM Sans import.

---

## 5. `.gitignore` Cleanup

All three `.gitignore` files were cleaned up:

- Root `.gitignore` — removed stray `a` character, removed hardcoded file paths (`backend/imagegen.py`, `certificate.png`, `.kiro/specs/...` entries), added `node_modules/` and `frontend/dist/`
- `frontend/.gitignore` — replaced Python-heavy content with a proper Node/Vite-focused list (`node_modules`, `dist`, `*.tsbuildinfo`, `vite.config.d.ts`)
- `backend/.gitignore` — cleaned up and added `uv.lock`

---

## 6. Spec Files Added

Three spec documents created under `.kiro/specs/certificate-studio-redesign/`:
- `requirements.md` — 10 requirements with EARS-format acceptance criteria
- `design.md` — component architecture, state shape, data models, API table, 13 correctness properties
- `tasks.md` — 30+ implementation tasks with requirement traceability
