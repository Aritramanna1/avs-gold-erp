import{n as e}from"./rolldown-runtime-aKtaBQYM.js";import{t}from"./data-provider-BiPx7OEV.js";var n=[{id:`faq_fine_gold`,knowledgeTier:`industry`,topic:`fine_gold`,title:`What is Fine Gold?`,language:`en-IN`,summary:`Fine gold is the pure 24K (99.9% / 1000 touch) gold content inside an alloy, calculated deterministically from net weight and purity.`,content:`Fine Gold is the weight of pure gold contained in a piece of jewellery or bullion, expressed in milligrams (mg) in Ornexa.

**Formula (authoritative):**
Fine Weight (mg) = Net Weight (mg) × (Purity Touch ÷ 1000)

**Example:** A 10g (10,000 mg) 22K ornament at 916 touch contains:
10,000 × 916/1000 = 9,160 mg fine gold = 9.16g fine.

Ornexa never uses floats for accounting. All gold is stored as integer milligrams. The Assistant and ERP core use the same calculation engine — never approximate fine gold mentally.`,keywords:[`fine gold`,`fine weight`,`pure gold`,`24k content`,`fine mg`,`999`],aliases:[`fine wt`,`sone ki shuddh matra`,`shuddh sona`],sourceDoc:`ITEM_AND_MATERIAL_MASTER.md`,relatedRoute:`/conversion`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_touch`,knowledgeTier:`industry`,topic:`touch_purity`,title:`What is Touch (Purity)?`,language:`en-IN`,summary:`Touch (or fineness) is purity expressed per thousand — 916 means 91.6% pure gold (22K). Ornexa stores purity as integer per-mille.`,content:`**Touch** (also called fineness or purity) measures how much pure gold is in an alloy, expressed per 1000 parts.

| Karat | Touch (per-mille) | Common Use |
|-------|-------------------|------------|
| 24K   | 999 / 1000        | Bullion, investment bars |
| 22K   | 916               | Indian jewellery standard |
| 18K   | 750               | Diamond jewellery, export |
| 14K   | 585               | Lightweight fashion |

In Ornexa, purity is always stored as an integer per-mille (e.g. 916, not 0.916). Touch is used to calculate fine gold weight and is snapshotted on every voucher so historical records remain accurate even if rates change.`,keywords:[`touch`,`purity`,`fineness`,`916`,`750`,`999`,`karat conversion`],aliases:[`purty`,`purity touch`,`touch percentage`],sourceDoc:`JEWELLERY_TERMINOLOGY_MASTER.md`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_gross_less_net_fine`,knowledgeTier:`industry`,topic:`weight_types`,title:`Gross, Less, Net and Fine Weight Explained`,language:`en-IN`,summary:`Gross = total piece weight. Less = stone/other deductions. Net = gold-only weight. Fine = pure gold content at touch.`,content:`**Gross Weight:** Total weight of the piece including stones, findings, and any attachments. Weighed on scale.

**Less Weight (Deductions):** Weight of stones, enamel, springs, screws, or other non-gold components subtracted from gross.

**Net Weight:** Gross − Less = actual gold alloy weight.
Net Weight (mg) = Gross Weight (mg) − Less Weight (mg)

**Fine Weight:** Pure gold content within the net weight.
Fine Weight (mg) = Net Weight (mg) × (Touch ÷ 1000)

In billing and manufacturing, making charges may be calculated on Gross or Net depending on your configured rules. Ornexa snapshots which basis was used on each voucher.`,keywords:[`gross weight`,`net weight`,`less weight`,`fine weight`,`stone deduction`,`gross less net`],aliases:[`gross wt`,`net wt`,`less wt`,`fine wt`],sourceDoc:`CALCULATION_AND_RULE_ENGINE.md`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_karat_purities`,knowledgeTier:`india`,topic:`karat_standards`,title:`What is 22K / 18K / 14K?`,language:`en-IN`,summary:`Karat indicates gold purity: 22K = 916 touch (91.6%), 18K = 750 (75%), 14K = 585 (58.5%). Indian trade standard for jewellery is 22K.`,content:`**22K (916 touch):** The Indian jewellery industry standard. 91.6% pure gold alloyed with copper/silver for durability. BIS hallmark for 22K shows 916.

**18K (750 touch):** Common for diamond-set jewellery and export pieces. 75% pure gold.

**14K (585 touch):** Lightweight fashion jewellery, common internationally.

**24K (999 touch):** Pure bullion bars and investment gold. Too soft for direct wear jewellery.

Ornexa stores all purities as integer per-mille. When you enter "22K", the system resolves to touch 916 automatically.`,keywords:[`22k`,`18k`,`14k`,`24k`,`916`,`750`,`585`,`karat`,`kt`],aliases:[`22 kt`,`18 kt`,`14 kt`,`22 carat`],sourceDoc:`ITEM_AND_MATERIAL_MASTER.md`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_customer_gold`,knowledgeTier:`industry`,topic:`customer_gold`,title:`What is Customer Gold?`,language:`en-IN`,summary:`Metal deposited by a customer (old ornaments, advance bullion) held in custody. Creates a liability until settled or used against an order.`,content:`**Customer Gold** (also called Customer Metal Deposit or Old Gold Advance) is physical gold received from a customer and held in your vault on their behalf.

**Key concepts:**
- **Ownership:** The gold belongs to the customer; you hold it in custody.
- **Liability:** Your books show a metal liability to the customer until settlement.
- **Utilization:** In manufacturing ERP, customer gold can be physically pooled/melted for production while the liability remains until Hisab/settlement.
- **Settlement:** Customer gold is settled by returning metal, adjusting against a new order, or converting to a cash credit at agreed Bhav (rate).

In Ornexa, customer gold deposits are tracked separately from company-owned vault stock. Use People → Party 360 or the Gold Book to view customer metal balances.`,keywords:[`customer gold`,`customer deposit`,`old gold advance`,`metal deposit`,`customer metal`],aliases:[`cust gold`,`party gold`,`jama sona`,`customer jama`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/workshop/gold-book`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_gold_payable_receivable`,knowledgeTier:`industry`,topic:`gold_balances`,title:`Gold Payable and Gold Receivable`,language:`en-IN`,summary:`Gold Receivable = metal owed TO you. Gold Payable = metal you owe TO a party (customer deposit, karigar return pending, supplier advance).`,content:`**Gold Receivable:** Fine gold that a party owes to your firm. Example: Karigar has not yet returned issued metal; customer owes metal against an advance order.

**Gold Payable:** Fine gold your firm owes to a party. Example: Customer gold deposit held in vault; supplier advance bullion not yet received.

These are metal ledger positions, distinct from cash receivable/payable. Ornexa tracks both money (₹ paise) and metal (mg fine gold) in parallel ledgers.

View firm-wide gold exposure in Reports → Gold Summary. View party-specific balances in People → Party 360 or ask the Assistant for a specific party's gold balance.`,keywords:[`gold payable`,`gold receivable`,`metal outstanding`,`gold due`,`gold liability`],aliases:[`sona udhar`,`gold udhar`,`metal receivable`],sourceDoc:`ORNEXA_DATA_AND_LEDGER_MODEL.md`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_karigar_gold`,knowledgeTier:`industry`,topic:`karigar_custody`,title:`What does Gold with Karigar mean?`,language:`en-IN`,summary:`Gold issued to a karigar (artisan) for manufacturing, held in their custody ledger until returned as finished goods or scrap.`,content:`**Gold with Karigar** means physical gold that has been issued from your vault to an artisan's bench/workshop for manufacturing, and has not yet been returned.

**In Ornexa:**
1. **Issue:** Gold moves from Vault → Karigar Custody (WIP ledger).
2. **Manufacturing:** Karigar works the gold against a Job Card.
3. **Receive:** Finished ornament + filing scrap returned; wastage (Ghat) calculated per agreement.
4. **Settlement (Hisab):** Net metal balance reconciled; labour charges booked.

Ask the Assistant "show [karigar name] gold balance" to see live custody from the ERP database. The Assistant reads actual ledger data — it never guesses balances.`,keywords:[`karigar gold`,`worker gold`,`gold with karigar`,`bench gold`,`wip gold`,`karigar custody`],aliases:[`karigar ka sona`,`worker custody`,`gold at karigar`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/workshop/gold-book`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_wastage`,knowledgeTier:`industry`,topic:`wastage`,title:`What is Wastage (Ghat)?`,language:`en-IN`,summary:`Allowed metal loss during manufacturing (filing, melting, polishing). Excess beyond agreed allowance is charged to karigar or written off.`,content:`**Wastage** (Ghat in Indian trade) is the metal lost during manufacturing processes — filing dust, melting loss, polishing loss, and chain-making waste.

**Types:**
- **Allowed Wastage:** Pre-agreed percentage per process/karigar (e.g. 0.5% for chain making).
- **Excess Wastage:** Loss beyond allowance — debited to karigar metal account or written off.
- **Recovery:** Filing dust and scrap collected and re-melted (recovery % tracked).

Ornexa calculates wastage at receive time by comparing issued fine gold vs returned fine gold + scrap. Configure allowed wastage rules in Customization → Calculations.`,keywords:[`wastage`,`ghat`,`loss`,`manufacturing loss`,`allowed wastage`,`filing loss`],aliases:[`ghat`,`metal loss`,`wastage allowance`],sourceDoc:`CALCULATION_AND_RULE_ENGINE.md`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_recovery`,knowledgeTier:`industry`,topic:`recovery`,title:`What is Recovery?`,language:`en-IN`,summary:`Metal recovered from filing dust, polishing scrap, and process waste — re-melted and returned to vault stock.`,content:`**Recovery** is the process of collecting and re-processing metal waste (filing dust, buffing dust, broken links) back into usable bullion or scrap stock.

In manufacturing:
1. Scrap/dust collected from karigar benches and polishing units.
2. Sent to refinery or melted in-house.
3. Assay determines actual fine gold recovered.
4. Recovery credited back to vault; difference from expected is recorded as process loss.

Track recovery in Workshop → Receive Metal and Melt/Conversion modules. Recovery percentage is a key KPI in manufacturing reconciliation reports.`,keywords:[`recovery`,`scrap recovery`,`filing recovery`,`dust recovery`,`polish recovery`],aliases:[`scrap return`,`dust collection`,`recovery percent`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/melt`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_refining`,knowledgeTier:`industry`,topic:`refining`,title:`What is Refining?`,language:`en-IN`,summary:`Converting scrap/old gold into high-purity bullion bars through melting, cupellation, or fire assay at a refinery.`,content:`**Refining** is the process of purifying impure gold (old ornaments, filing scrap, mixed alloys) into standard purity bars (typically 999 fine).

**Process:**
1. Scrap/old gold sent to accredited refinery (BIS/NABL lab).
2. Fire assay or XRF determines actual purity and fine gold content.
3. Refinery returns 999 bar; melting loss and assay charges deducted.
4. Refined bar inward to vault; loss written off or charged.

In Ornexa, record refinery transactions via Supplier Purchases, Melt Jobs, or Metal Conversion. Track refinery parties in People with type Refinery.`,keywords:[`refining`,`refinery`,`melting`,`fire assay`,`cupellation`,`999 bar`],aliases:[`refinary`,`saaf sona`,`bullion conversion`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/melt`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_hallmark_huid`,knowledgeTier:`india`,topic:`hallmarking`,title:`Hallmarking and HUID Explained`,language:`en-IN`,summary:`BIS hallmark certifies gold purity. HUID (Hallmark Unique ID) is a 6-character alphanumeric code laser-marked on each piece since July 2021.`,content:`**BIS Hallmarking** is India's mandatory purity certification for gold jewellery (22K, 18K, 14K) administered by Bureau of Indian Standards.

**HUID (Hallmark Unique ID):** Since 1 July 2021, every hallmarked piece carries a unique 6-character alphanumeric HUID laser-marked on the article. This enables traceability from assaying centre to retail sale.

**In Ornexa:**
- Record hallmark batches in Stock → Hallmark.
- Link HUID codes to inventory tags for traceability.
- Hallmark charges tracked as manufacturing/subcontract cost.

The Assistant will never invent or alter HUID codes — these are protected identifiers.`,keywords:[`hallmark`,`huid`,`bis`,`hallmarking`,`purity certificate`,`assay mark`],aliases:[`halmark`,`hall mark`,`bis hallmark`,`huid code`],sourceDoc:`TAGGING_AND_TRACEABILITY_MASTER.md`,relatedRoute:`/stock/hallmark`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_gold_issue_receive`,knowledgeTier:`product`,topic:`gold_issue_receive`,title:`How does Gold Issue and Receive work in Ornexa?`,language:`en-IN`,summary:`Issue transfers metal from vault to karigar custody. Receive records return of finished goods and scrap, calculating wastage.`,content:`**Gold Issue (Metal Issue Slip):**
1. Go to Workshop → Gold Book or Worker Book.
2. Select Karigar → Issue Metal.
3. Enter Gross Wt, Purity (Touch), Job Card reference.
4. System calculates Fine Gold and posts vault OUT + karigar custody IN.

**Gold Receive (Metal Receive Voucher):**
1. Workshop → Receive Metal against Job Card.
2. Enter finished goods weight, scrap returned, stone deductions.
3. System calculates allowed wastage vs actual loss.
4. Posts karigar custody OUT + vault/finished stock IN.

Both operations are atomic ledger postings. The Assistant can draft an Issue slip but requires your confirmation before posting (Risk Level 3).`,keywords:[`gold issue`,`gold receive`,`issue gold`,`receive gold`,`metal issue`,`metal receive`],aliases:[`isshu gold`,`recive gold`,`issue metal`,`receive metal`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/workshop/gold-book`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_metal_conversion`,knowledgeTier:`product`,topic:`metal_conversion`,title:`How does Metal Conversion work?`,language:`en-IN`,summary:`Converts bullion/scrap from one purity/form to another (e.g. 24K bar → 22K alloy) with alloy addition and melting loss tracking.`,content:`**Metal Conversion** in Ornexa converts physical metal between purities and forms:

1. Navigate to Conversion (/conversion) or Melt (/melt).
2. Select source lot (e.g. 24K bullion bar, scrap lot).
3. Specify target purity (e.g. 22K at 916 touch) and alloy type.
4. Enter expected melting loss and alloy addition weight.
5. System creates source lot deduction + new target lot with atomic ledger posting.

Ownership separation: Customer-owned metal in custody can be converted while liability remains active until settlement.`,keywords:[`metal conversion`,`alloy`,`melt`,`purity conversion`,`24k to 22k`,`bullion conversion`],aliases:[`dhalai`,`melt conversion`,`alloy addition`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/conversion`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_gold_book`,knowledgeTier:`product`,topic:`gold_book`,title:`What is a Gold Book?`,language:`en-IN`,summary:`The Gold Book is the karigar/worker metal custody ledger — tracks all gold issued to and received from each artisan.`,content:`The **Gold Book** (Karigar Gold Book / Worker Book) is the manufacturing metal ledger for each karigar:

- **Issue entries:** Gold given to the worker for a job.
- **Receive entries:** Finished goods and scrap returned.
- **Running balance:** Net fine gold in worker's custody.
- **Hisab:** Periodic settlement reconciling metal + labour charges.

Access via Workshop → Gold Book (/workshop/gold-book) or individual Worker Books. Ask the Assistant "show [name] gold book" for live balances from the database.`,keywords:[`gold book`,`karigar book`,`worker book`,`metal book`,`custody ledger`],aliases:[`sona ki kitab`,`karigar khata`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/workshop/gold-book`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_karigar_book`,knowledgeTier:`product`,topic:`karigar_book`,title:`What is a Karigar Book?`,language:`en-IN`,summary:`Per-karigar ledger showing metal issue/receive history, wastage, labour charges, and settlement status.`,content:`A **Karigar Book** is the individual artisan's manufacturing account in Ornexa:

- Metal issued and received (with fine gold calculations).
- Allowed vs actual wastage per job.
- Labour/making charges accrued.
- Payment and settlement history.
- Active job cards linked to metal custody.

Navigate to Workshop → Worker Books → select karigar. Each outside worker (Mina, Polish) also has a dedicated book.`,keywords:[`karigar book`,`worker book`,`artisan ledger`,`bench book`],aliases:[`karigar khata`,`worker ledger`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/workshop/worker-books`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_party_ledger`,knowledgeTier:`industry`,topic:`party_ledger`,title:`What is Party Ledger?`,language:`en-IN`,summary:`Complete financial and metal transaction history for a customer, supplier, or karigar — the Khata.`,content:`**Party Ledger** (Khata) is the running account of all transactions with a business party:

- **Cash ledger:** Money received (Jama) and paid (Udhar) in ₹.
- **Metal ledger:** Gold issued, received, and settled in fine grams.
- **Combined view:** Party 360 shows both ledgers, open orders, and documents.

In Ornexa, open People → select party → Ledger tab. The Assistant can fetch live party balances but never invents figures — always from the authoritative database.`,keywords:[`party ledger`,`khata`,`account statement`,`party balance`,`ledger`],aliases:[`khata`,`party khata`,`hisab`],sourceDoc:`PARTY_360_MASTER.md`,relatedRoute:`/people`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_opening_balance`,knowledgeTier:`industry`,topic:`opening_balance`,title:`What is Opening Balance?`,language:`en-IN`,summary:`Starting cash and metal balances when onboarding or at financial year start. Set via Migration Wizard or Party opening entries.`,content:`**Opening Balance** is the starting position of cash (₹) and metal (fine gold mg) for a party or account at the beginning of operations or a new financial year.

**In Ornexa:**
1. Use Control → Migration Wizard for bulk opening balance import.
2. Or set per-party opening in People → Party → Opening Balance tab.
3. Chart of Accounts opening balances set in Control → Accounts.

Opening balances post as special voucher types (opening_vault, opening_cash) and are included in reconciliation reports. Never edit opening balances after period lock without authorization.`,keywords:[`opening balance`,`opening stock`,`opening gold`,`migration`,`opening cash`],aliases:[`shuruati balance`,`opening bal`,`ob`],sourceDoc:`OPENING_BALANCE_AND_MIGRATION_MASTER.md`,relatedRoute:`/control/migration`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_customer_gold_settlement`,knowledgeTier:`product`,topic:`customer_settlement`,title:`How is Customer Gold Settled?`,language:`en-IN`,summary:`Customer gold is settled by returning metal, adjusting against a new order/invoice, or converting to cash credit at agreed Bhav.`,content:`**Customer Gold Settlement** closes the metal liability to a customer:

1. **Return Metal:** Physical gold returned to customer (outward voucher).
2. **Adjust Against Order:** Customer gold applied to a manufacturing order or invoice.
3. **Cash Conversion:** Metal valued at agreed Bhav (daily rate) and credited as cash balance.
4. **Combined Settlement:** Part metal return + part cash adjustment.

In Ornexa: Settlement module (/settlement) or Billing → Gold Settlement. The settlement voucher posts metal liability reduction and creates audit trail. Ask the Assistant about settlement workflow but verify actual balances from live data.`,keywords:[`customer gold settlement`,`settle gold`,`gold settlement`,`hisab`,`metal settlement`],aliases:[`sona settle`,`gold hisab`,`customer settlement`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/settlement`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_create_customer`,knowledgeTier:`product`,topic:`create_customer`,title:`How do I create a Customer in Ornexa?`,language:`en-IN`,summary:`Add customers, suppliers, karigars via People module with KYC, GSTIN, and opening balances.`,content:`**Steps:**
1. Navigate to People (/people).
2. Click "+ New Party".
3. Enter Full Name, Mobile, Type (Customer/Supplier/Karigar/Dealer).
4. Add GSTIN, PAN, Address as needed.
5. Optionally set Opening Cash and Opening Gold balances.
6. Save — party is immediately available in Billing, Orders, and Ledgers.

You can also ask the Assistant "create a customer" to start a guided draft flow.`,keywords:[`create customer`,`add customer`,`new party`,`add karigar`,`new supplier`],aliases:[`costomer create`,`add party`,`new customer`],sourceDoc:`PARTY_360_MASTER.md`,relatedRoute:`/people`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_create_order`,knowledgeTier:`product`,topic:`create_order`,title:`How do I create an Order in Ornexa?`,language:`en-IN`,summary:`Manufacturing orders track custom jewellery from design approval through production to delivery.`,content:`**Steps:**
1. Go to Orders (/orders) → New Order.
2. Select Customer (party).
3. Add design reference, expected weight, purity, delivery date.
4. Add line items (designs from catalogue or custom description).
5. Save as Draft or Confirm to start manufacturing workflow.
6. Confirmed orders generate Job Cards in Workshop.

Ask the Assistant "create an order" for a guided draft, or say "show overdue orders" for live production queue.`,keywords:[`create order`,`new order`,`manufacturing order`,`custom order`],sourceDoc:`WORKFLOW_MASTER.md`,relatedRoute:`/orders/new`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_create_job`,knowledgeTier:`product`,topic:`create_job`,title:`How do I create a Job Card in Ornexa?`,language:`en-IN`,summary:`Job Cards track manufacturing stages from casting through setting, polish, QC, and hallmark.`,content:`**Steps:**
1. From a confirmed Order, click "Create Job Card" or go to Workshop → Job Cards.
2. Assign Karigar (worker) and process type.
3. Set expected completion date and allowed wastage.
4. Issue gold to karigar against the job card.
5. Track stages: Casting → Filing → Setting → Polish → QC → Hallmark → Stock.

The Assistant can search jobs by status, karigar, or due date using live ERP data.`,keywords:[`create job`,`job card`,`new job`,`assign job`,`manufacturing job`],sourceDoc:`MANUFACTURING_LEDGER_MASTER.md`,relatedRoute:`/workshop`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_create_invoice`,knowledgeTier:`product`,topic:`create_invoice`,title:`How do I create an Invoice in Ornexa?`,language:`en-IN`,summary:`GST-compliant tax invoices with metal valuation, making charges, stone details, and payment split.`,content:`**Steps:**
1. Go to Billing (/billing) → New Invoice.
2. Select Customer.
3. Add items: ready stock tags, custom items, or old gold exchange lines.
4. System calculates metal value at Bhav, making charges, GST (3% on making for gold jewellery).
5. Record payment split (Cash/UPI/Bank/Gold adjustment).
6. Save and Print.

Ask the Assistant "create invoice for [customer]" to start a draft, or "search invoice [number]" for existing bills.`,keywords:[`create invoice`,`new invoice`,`billing`,`tax invoice`,`make bill`],aliases:[`invoce`,`new bill`,`generate invoice`],sourceDoc:`DOCUMENT_PRINTING_MASTER.md`,relatedRoute:`/billing`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_old_gold_exchange`,knowledgeTier:`india`,topic:`old_gold`,title:`Old Gold Exchange Concepts`,language:`en-IN`,summary:`Customer brings old ornaments; assessed for weight/purity, valued at Bhav, adjusted against new purchase.`,content:`**Old Gold Exchange** (OG Purchase) is a common Indian retail and wholesale practice:

1. Customer brings old gold ornaments.
2. Gross weight measured; stone/enamel less deducted.
3. Purity tested (XRF/acid touchstone); touch recorded.
4. Fine gold calculated; valued at day's Bhav (rate).
5. Amount adjusted against new purchase invoice or paid in cash.

In Ornexa: Billing → Old Gold Purchase line, or dedicated Old Gold Purchase voucher. KYC required for purchases above regulatory threshold.`,keywords:[`old gold`,`old gold exchange`,`scrap purchase`,`og purchase`,`exchange`],aliases:[`purana sona`,`old gold purchase`,`scrap gold`],sourceDoc:`BUSINESS_RULES.md`,relatedRoute:`/billing`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_gst_jewellery`,knowledgeTier:`india`,topic:`gst`,title:`GST on Jewellery — Quick Reference`,language:`en-IN`,summary:`Gold jewellery GST: 3% on making charges (1.5% CGST + 1.5% SGST). Pure gold/bullion has different rates. Ornexa calculates GST deterministically.`,content:`**Indian GST on Gold Jewellery (as documented in Ornexa):**

- **Making Charges:** 3% GST (1.5% CGST + 1.5% SGST) on making/labour value.
- **Gold Value:** On supply of gold ornaments, GST applies per current CBIC notifications (configured in tenant tax settings).
- **Old Gold Purchase:** Specific valuation and GST rules apply; configured per voucher type.

Ornexa's billing engine calculates GST in integer paise with proper rounding. The Assistant explains GST concepts but actual tax amounts always come from posted invoices — never estimated by AI.`,keywords:[`gst`,`cgst`,`sgst`,`tax`,`gst on jewellery`,`making charges gst`],aliases:[`gst rate`,`tax on gold`,`3 percent gst`],sourceDoc:`BUSINESS_RULES.md`,relatedRoute:`/billing`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0},{id:`faq_assistant_capabilities`,knowledgeTier:`product`,topic:`assistant_help`,title:`What can the Ornexa Assistant do?`,language:`en-IN`,summary:`Query live ERP data, explain jewellery concepts, guide workflows, draft vouchers — all permission-aware without inventing balances.`,content:`The Ornexa Assistant operates in two modes:

**Standard (Zero Cost):** Answers terminology and workflow questions from the Knowledge Repository. Queries live ERP data through authorized tools. Drafts vouchers with your confirmation. Works offline.

**Cloud AI (Metered):** Enhanced reasoning for complex cross-module questions. Still uses ERP tools for all data — never guesses balances.

**I can help with:**
- "Where is my gold?" — live vault/workshop breakdown
- "Show Raj Jewellers gold balance" — party-specific live data
- "What is fine gold?" — knowledge lookup
- "Create a customer" — guided draft flow
- "How do I issue gold?" — workflow guidance

**I will never:** Invent balances, modify data without confirmation, or bypass permissions.`,keywords:[`assistant`,`help`,`what can you do`,`capabilities`,`features`],aliases:[`help me`,`what do you do`,`ornexa assistant`],sourceDoc:`ASSISTANT_MASTER.md`,relatedRoute:`/assistant`,version:`1.0.0`,effectiveFrom:`2026-01-01`,lastReviewedAt:`2026-08-15`,isSystem:!0}],r=[/\bINV[-/]?\d{4,}[-/]?\d+\b/gi,/\bEST[-/]?\d+\b/gi,/\b[A-Z]{2,}\d{6,}\b/g,/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,/\b\d{6}\b/g,/\b\+?\d{10,13}\b/g,/\b₹?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/g,/\b\d+(?:\.\d+)?\s*(?:g|gm|gram|grams|mg|ct|carat)\b/gi,/\b\d{3,4}\b/g],i={karigr:`karigar`,karigarrr:`karigar`,karigarr:`karigar`,kargir:`karigar`,kariger:`karigar`,goldsmith:`karigar`,bhav:`bhav`,bhaav:`bhav`,bhaw:`bhav`,bhaaw:`bhav`,jma:`jama`,jamaa:`jama`,halmark:`hallmark`,hallmrk:`hallmark`,huid:`hallmark huid`,purty:`purity`,puritty:`purity`,touchh:`touch`,recive:`receive`,recieved:`received`,isshu:`issue`,issu:`issue`,trasfer:`transfer`,costomer:`customer`,custmer:`customer`,invoce:`invoice`,invioce:`invoice`,refinary:`refinery`,refinry:`refinery`,jewlers:`jewellers`,jeweller:`jewellers`,jewler:`jewellers`,jewllery:`jewellery`,jewlry:`jewellery`,sone:`gold`,sona:`gold`,kaam:`work`,hisaab:`hisab`,hisab:`settlement`,udhar:`outstanding`,jama:`receipt`,nikasi:`issue`,ghat:`wastage`,milavat:`alloy`,dhalai:`melting`,saaf:`refining`,og:`old gold`,dc:`delivery challan`,gst:`gst`,hsn:`hsn`,kyc:`kyc`},a=[[/\bisshu\s+gold\b/gi,`issue gold`],[/\brecive\s+gold\b/gi,`receive gold`],[/\bgold\s+with\s+karigar\b/gi,`karigar gold balance`],[/\bkarigar\s+gold\b/gi,`karigar gold balance`],[/\bgold\s+book\b/gi,`gold book`],[/\bparty\s+ledger\b/gi,`party ledger`],[/\bopening\s+bal(ance)?\b/gi,`opening balance`],[/\bold\s+gold\b/gi,`old gold purchase`],[/\bfine\s+wt\b/gi,`fine weight`],[/\bgross\s+wt\b/gi,`gross weight`],[/\bnet\s+wt\b/gi,`net weight`],[/\bhisab\s+final\b/gi,`hisab final settlement`]];function o(e,t){let n=e.length,r=t.length;if(n===0)return r;if(r===0)return n;let i=Array.from({length:n+1},()=>Array(r+1).fill(0));for(let e=0;e<=n;e++)i[e][0]=e;for(let e=0;e<=r;e++)i[0][e]=e;for(let a=1;a<=n;a++)for(let n=1;n<=r;n++){let r=e[a-1]===t[n-1]?0:1;i[a][n]=Math.min(i[a-1][n]+1,i[a][n-1]+1,i[a-1][n-1]+r)}return i[n][r]}function s(e){return e.toLowerCase().replace(/[^a-z]/g,``).replace(/[aeiou]/g,``).replace(/(.)\1+/g,`$1`).slice(0,6)}function c(e,t){let n=s(e),r=s(t);if(!n||!r)return 0;if(n===r)return 1;let i=o(n,r),a=Math.max(n.length,r.length);return a===0?0:1-i/a}function l(e,t){let n=e.toLowerCase(),r=t.toLowerCase();if(n===r)return 1;if(r.includes(n)||n.includes(r))return .85;let i=o(n,r),a=Math.max(n.length,r.length);if(i>(a<=4?1:a<=6?2:3)){let e=c(n,r);return e>=.75?e*.9:0}return 1-i/a}function u(e){let t=e.toLowerCase();return/\b(kay|kasa|kiti|ahe|mala|dakhva)\b/.test(t)?`mr-roman`:/\b(kya|kaise|kahan|hai|hain|mujhe|batao|dikhao|kitna|kaun|sone|sona|udhar|jama|hisab|karigar|bhav)\b/.test(t)||/[\u0900-\u097F]/.test(e)?`hi-roman`:/[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF]/.test(e)?`mixed`:`en-IN`}function d(e){let t=[];for(let n of r){let r=new RegExp(n.source,n.flags),i;for(;(i=r.exec(e))!==null;)t.push({start:i.index,end:i.index+i[0].length,text:i[0]})}return t.sort((e,t)=>e.start-t.start)}function f(e,t){return t.some(t=>e>=t.start&&e<t.end)}function p(e,t={}){let n=e.trim(),r=[];for(let[e,t]of a){let i=n;n=n.replace(e,t),n!==i&&r.push({from:i.match(e)?.[0]??``,to:t})}let o=d(n),s={...i,...t.tenantAliases},c=n.split(/(\s+)/);return{normalized:c.map((e,t)=>{if(/^\s+$/.test(e))return e;let n=c.slice(0,t).join(``).length;if(f(n,o))return e;let i=e.toLowerCase().replace(/[.,!?;:]+$/,``),a=e.slice(i.length);if(s[i]){let e=s[i];return e!==i&&r.push({from:i,to:e}),e+a}let u=``,d=0;for(let e of Object.keys(s)){if(e.length<3)continue;let t=l(i,e);t>d&&t>=.78&&(d=t,u=e)}if(u){let e=s[u];return e!==i&&r.push({from:i,to:e}),e+a}return e}).join(``).replace(/\s+/g,` `).trim(),corrections:r}}function m(e){return r.some(t=>RegExp(`^${t.source}$`,t.flags.replace(`g`,``)).test(e))}function h(e){let t=new Set(`show.find.search.get.tell.what.is.the.my.me.for.of.gold.balance.position.ledger.book.customer.party.karigar.worker.invoice.order.job.stock.outstanding.a.an.please.can.you.how.much.where.their.his.her.this.that`.split(`.`)),n=e.toLowerCase().replace(/[^a-z0-9\s&'.-]/gi,` `).split(/\s+/).filter(e=>e.length>1&&!t.has(e)&&!m(e));if(n.length===0)return[];let r=[],i=n.join(` `);i.length>=3&&r.push(i);for(let e=Math.min(4,n.length);e>=2;e--)for(let t=0;t<=n.length-e;t++){let i=n.slice(t,t+e).join(` `);i.length>=3&&!r.includes(i)&&r.push(i)}for(let e of n)e.length>=4&&!r.includes(e)&&r.push(e);return r.slice(0,5)}var g=e({formatKnowledgeAnswer:()=>E,getAllArticles:()=>S,hydrateKnowledgeRepository:()=>C,searchKnowledgeRepository:()=>w,seedSystemArticlesToDatabase:()=>D,toKnowledgeSourceRef:()=>T}),_=null,v=[],y=null;function b(e){return e.toLowerCase().replace(/[^a-z0-9\s]/g,` `).split(/\s+/).filter(e=>e.length>1)}function x(e,t,n){let r=[e.title,e.summary,e.topic,...e.keywords,...e.aliases??[],e.content.slice(0,500)].join(` `).toLowerCase(),i=0,a=[];for(let n of t)e.title.toLowerCase().includes(n)&&(i+=12,a.push(n)),e.keywords.some(e=>e.toLowerCase().includes(n)||l(n,e)>.8)&&(i+=8,a.push(n)),e.aliases?.some(e=>e.toLowerCase().includes(n)||l(n,e)>.8)&&(i+=9,a.push(n)),e.summary.toLowerCase().includes(n)&&(i+=4),r.includes(n)&&(i+=2);let o=n.toLowerCase();if(e.title.toLowerCase().includes(o)&&(i+=20),e.summary.toLowerCase().includes(o)&&(i+=10),/^what (is|does|are)\b/.test(o)&&e.topic){let t=e.topic.replace(/_/g,` `);o.includes(t)&&(i+=15)}return i<6?null:{article:e,score:i,matchedTerms:[...new Set(a)],knowledgeTier:e.knowledgeTier}}function S(){return[..._??n,...v]}async function C(){return y||(y=(async()=>{_=n;try{let{data:e,error:n}=await t.from(`assistant_knowledge_articles`).select(`id,knowledge_tier,topic,title,language,summary,content,keywords,aliases,source_doc,related_route,version,effective_from,last_reviewed_at,is_system,firm_id`).eq(`is_active`,!0).limit(500);!n&&e&&e.length>0&&(v=e.map(e=>({id:String(e.id),knowledgeTier:e.knowledge_tier,topic:String(e.topic),title:String(e.title),language:String(e.language??`en-IN`),summary:String(e.summary),content:String(e.content),keywords:Array.isArray(e.keywords)?e.keywords:[],aliases:Array.isArray(e.aliases)?e.aliases:[],sourceDoc:e.source_doc?String(e.source_doc):void 0,relatedRoute:e.related_route?String(e.related_route):void 0,version:String(e.version??`1.0.0`),effectiveFrom:String(e.effective_from??`2026-01-01`),lastReviewedAt:String(e.last_reviewed_at??new Date().toISOString()),isSystem:!!e.is_system,firmId:e.firm_id?String(e.firm_id):void 0})).filter(e=>!e.isSystem))}catch{}try{let{count:e}=await t.from(`assistant_knowledge_articles`).select(`id`,{count:`exact`,head:!0}).eq(`is_system`,!0);(e??0)===0&&await D()}catch{}})(),y)}function w(e,t={}){let{normalized:n}=p(e,{tenantAliases:t.tenantAliases}),r=n||e,i=b(r),a=t.limit??3,o=t.tiers,s=S().filter(e=>!o||o.includes(e.knowledgeTier)),c=[];for(let e of s){let t=x(e,i,r);t&&c.push(t)}return c.sort((e,t)=>t.score-e.score).slice(0,a)}function T(e){let t=e.article;return{id:t.id,title:t.title,topic:t.topic,knowledgeTier:t.knowledgeTier,sourceDoc:t.sourceDoc,relatedRoute:t.relatedRoute,lastReviewedAt:t.lastReviewedAt}}function E(e){if(e.length===0)return{content:``,sources:[],confidence:`low`};let t=e[0],n=e.map(T),r=t.article.summary;t.score>=15&&(r=`${t.article.summary}\n\n${t.article.content}`);let i=t.score>=20?`high`:t.score>=10?`medium`:`low`;return{content:r,sources:n,confidence:i}}async function D(){let e=n.map(e=>({id:e.id,firm_id:null,knowledge_tier:e.knowledgeTier,topic:e.topic,title:e.title,language:e.language,summary:e.summary,content:e.content,keywords:e.keywords,aliases:e.aliases,source_doc:e.sourceDoc??null,related_route:e.relatedRoute??null,version:e.version,effective_from:e.effectiveFrom,last_reviewed_at:e.lastReviewedAt,is_system:!0,is_active:!0}));await t.from(`assistant_knowledge_articles`).upsert(e,{onConflict:`id`})}export{T as a,l as c,c as d,w as i,m as l,C as n,u as o,g as r,h as s,E as t,p as u};