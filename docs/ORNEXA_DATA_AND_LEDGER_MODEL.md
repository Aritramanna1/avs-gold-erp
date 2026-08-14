# Ornexa Data And Ledger Model

## Core Identities

Tenant, branch, location, user, role, permission, party, item, material, tag, process, transaction, document, ledger entry, audit event, and configuration version.

## Party Model

Use one canonical party identity with role profiles. A party may be customer, supplier, karigar, employee, carrier, wholesaler, retailer, billing party, or branch/site.

## Ledger Families

Financial: receivable, payable, cash, bank, expense, investment, revenue, cost, tax, round-off.

Metal: gross, net, fine, purity/touch, issued, received, loss, waste, recovery, worker balance.

Stone/Diamond: pieces, weight/carat, quality, cost/value, issued, received, sold, returned.

Operational: pieces, tags, parcels, WIP, in-transit, reserved, approved, rejected, expired.

People: salary, advance, bonus, credit salary, labour dues, incentives.

## Required Properties

Ledger entries must be scoped to tenant/branch where applicable, carry source transaction/document IDs, use explicit units, and be reversible through compensating entries.
