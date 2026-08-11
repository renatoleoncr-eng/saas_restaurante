---
status: investigating
trigger: "estamos dando vueltas en circulos con el barrido correcto de errores y variables /GSD Debugger"
created: 2026-08-09T23:01:00Z
updated: 2026-08-09T23:01:00Z
---

## Current Focus
hypothesis: There is still an undeclared variable causing a ReferenceError on mount of TableControl or PaymentModal, but ESLint missed it, or the VPS deployment did not actually pull the latest code properly, OR the browser cache is holding onto the old JS chunk.
test: I will run `npm run build` and serve the production build locally to reproduce.
expecting: The error will reproduce locally if it's a code issue.
next_action: Run a local Vite preview server.

## Symptoms
expected: TableControl and PaymentModal load successfully when a table is clicked.
actual: App crashes with "Algo salió mal" and "ReferenceError: Can't find var" (truncated).
errors: "ReferenceError: Can't find var..."

## Eliminated
- hypothesis: fetchAccount TDZ (fixed by converting to function declaration)
- hypothesis: fetchBillingConfig/fetchQrs not defined in TableControl (fixed by removing them from useEffect)

## Evidence
- checked: ESLint ran successfully on jsx files and showed `no-undef` errors which were fixed and pushed to main.
  found: `fetchBillingConfig`, `fetchQrs`, `setPayAmount`, `setIsConfirmingPayment`, `setIssueInvoice`, `setInvoiceType` were all fixed.
  implication: If it's a code issue, it's something else not caught by ESLint `no-undef`.

## Resolution
root_cause: `isHappyHourActive` was heavily used in `TableControl.jsx`'s JSX rendering (16 times) to show prices, but it was not imported. It was missed because ESLint buried it at the bottom of 30+ TDZ warnings. When a table was selected, the UI crashed attempting to read the undefined function.
fix: Imported `isHappyHourActive` from `timeUtils.js`. Verified via strict ESLint flat config that ZERO `no-undef` errors exist now.
verification: Pushed to main and deployed to VPS. User must hard-reload.
