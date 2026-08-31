# Jewellery ERP Reference Matrix

This matrix preserves jewellery ERP depth without copying competitor source code, assets, wording, or visual design. It treats Jwelly/JewelAcc/Appitsoft and AVS/JewelAcc research as product references only. The truth remains the approved Ornexa/AVS product direction plus Product Owner decisions.

Decision values: KEEP EXISTING, IMPROVE, IMPLEMENT, MERGE, NOT RELEVANT, SUPERSEDED BY BETTER ORNEXA WORKFLOW.

| Feature / Concept                    | Original Ornexa Vision                     | Current Ornexa                                      | Jwelly / JewelAcc / Appitsoft Concepts       | Final Ornexa Decision                               | Status  |
| ------------------------------------ | ------------------------------------------ | --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- | ------- |
| Central party system                 | One party with role profiles               | People module exists, role model needs verification | Customer, supplier, karigar, account masters | MERGE into one Party 360 with role extensions       | PARTIAL |
| Account groups and ledgers           | Cash, bank, party, karigar, metal ledgers  | Ledger and billing modules exist                    | Account groups, day book, outstanding        | IMPROVE with central accounting foundation          | PARTIAL |
| Metal engine                         | Gross/net/fine/touch/purity/rate snapshots | Multiple services and ledgers exist                 | Fine weight, touch, wastage, bhav            | MERGE into authoritative shared metal service       | PARTIAL |
| Daily bhav / metal rates             | Global plus branch override                | Global rate surfaced; branch override gap           | Daily bhav, branch-wise rates                | IMPLEMENT branch overrides and historical snapshots | PARTIAL |
| Purchase / purchase return           | Supplier inward and payable                | Supplier purchase migrations/routes exist           | Purchase register, supplier ageing           | IMPROVE with central transaction posting            | PARTIAL |
| Sale / sale return                   | Billing, GST, receipt, reversal            | Billing exists                                      | Sale register, GST, return                   | KEEP and harden reversal/audit/tests                | PARTIAL |
| Receipt / payment / contra / journal | Core accounting events                     | Payment/settlement partial                          | Receipt, payment, journal, contra            | IMPLEMENT as central transaction types              | PARTIAL |
| Karigar issue/receive                | Manufacturing-first custody                | Worker/gold book exists                             | Karigar issue/receive, hisab final           | IMPROVE with outside work traceability and portal   | PARTIAL |
| Hisab Final                          | Karigar settlement                         | Settlement exists but needs workflow audit          | Hisab final, metal/cash settlement           | IMPLEMENT verified settlement workflow              | PARTIAL |
| Job order / work book                | Order to job card to production            | Job/workshop routes exist                           | Work book, job order                         | IMPROVE with manufacturing graph                    | PARTIAL |
| Loss / wastage / recovery            | Explicit dimensions and approvals          | Some ledgers/calculations exist                     | Loss consideration, wastage, recovery        | IMPLEMENT central rules and approval                | PARTIAL |
| Old gold exchange                    | Appraisal, touch, settlement, refinery     | Basic flow references exist                         | Old gold appraisal and melt rules            | IMPLEMENT approved appraisal rules with snapshots   | PARTIAL |
| Refinery                             | Scrap outward, return, loss, charges       | Generic ledger paths partial                        | Refinery batches                             | IMPLEMENT dedicated batch lifecycle                 | MISSING |
| Hallmark / HUID                      | Outward, return, HUID, charges             | Hallmark routes/tables partial                      | HUID, hallmark charges                       | IMPROVE with custody lifecycle                      | PARTIAL |
| QC                                   | Configurable checklists and release        | Approval/QC partial                                 | QC in manufacturing ERPs                     | IMPLEMENT configurable QC gate                      | PARTIAL |
| Tag generation/modification/stock    | Barcode/QR/HUID/tag stock                  | Routes exist                                        | Tag generation, tag stock, box/tray          | IMPROVE central inventory/tag foundation            | PARTIAL |
| Box/tray/location                    | Inventory custody locations                | Partial                                             | Box/tray, branch stock                       | IMPLEMENT central location model                    | PARTIAL |
| Physical stock / ageing / dead stock | Stock audit and exception reports          | Partial reports/routes                              | Physical stock, stock ageing, dead stock     | IMPLEMENT verified audit workflow                   | PARTIAL |
| Bank reconciliation                  | Finance control                            | Unknown/partial                                     | Bank reconciliation                          | IMPLEMENT if approved for accounting scope          | MISSING |
| Tally export                         | Export-ready accounting                    | Partial docs/routes                                 | Tally export                                 | IMPROVE after ledger mapping verification           | PARTIAL |
| Report save / verify                 | Reproducible reports                       | Report routes exist                                 | Report save, verify                          | IMPLEMENT report metadata and verification          | PARTIAL |
| Web orders                           | Portal/order intake                        | Customer portal partial                             | Web orders                                   | IMPLEMENT where approved                            | PARTIAL |
| AI intelligence                      | Assistant over authorized ERP data         | Assistant persistence migrated; UI partial          | Appitsoft insights                           | IMPROVE with deterministic ERP tools                | PARTIAL |
| Recommendations                      | Business prompts/follow-up                 | Notifications partial                               | Recommendations                              | IMPLEMENT through follow-up/assistant engine        | MISSING |
| Backup/restore                       | Mandatory operational control              | Docs exist                                          | Backup/restore                               | IMPROVE and verify restore tests                    | PARTIAL |

## Centralization Rule

Useful concepts must be implemented as views over shared authoritative systems, not as disconnected mini-modules. Target foundations:

- One party system.
- One user/role system.
- One firm/branch model.
- One metal engine.
- One transaction foundation.
- One inventory foundation.
- One manufacturing graph.
- One accounting foundation.
- One document engine.
- One storage architecture.
- One notification/follow-up engine.
- One audit system.
- One reporting foundation.
- One assistant tool layer.
