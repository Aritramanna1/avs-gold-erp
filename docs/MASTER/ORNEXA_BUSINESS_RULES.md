# Ornexa Business Rules

## Universal Transaction Contract

Every transaction must define purpose, actor, inputs, validations, calculations, state transitions, stock impact, metal/stone impact, cash/ledger impact, documents, reports, permissions, audit event, exception path, and reversal path.

## Dual Accounting

Maintain independent ledgers for financial value, gross/net/fine metal, stones/diamonds, operational pieces/tags/WIP, and people/labour balances.

## Formula And Rate Rules

Calculations must be explicit, versioned, and explainable. Store snapshots of rate, purity, touch, wastage, making, tax, discounts, approvals, numbering, and formulas used at posting time. Changing configuration must not alter historical transactions.

## Posting And Reversal

Draft records may be edited. Posted stock, fine, invoice, payroll, period close, and sensitive ledger changes require reversal/adjustment with reason and audit, not raw deletion.

## Manufacturing Custody

Material issue creates accountability against process/worker/location. Receive reconciles issued vs received plus loss, waste, recovery, labour, and variance. Over-tolerance variance routes to approval.

## Close Controls

Day close must check unposted transactions, pending approvals, open cash sessions, negative stock, unmatched issue/receive, unresolved variances, unallocated payments, and document failures. Reopening requires elevated authorization and audit reason.
