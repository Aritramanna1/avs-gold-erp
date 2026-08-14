# Ornexa AI Action Registry

This document serves as the master registry for all conversational and automated actions supported by the Ornexa AI Assistant. It defines the Universal Conversational Action Engine definitions. Each action outlines the exact requirements, permissions, and dependencies needed before the AI can execute a deterministic ERP workflow.

## 1. Create Party (Customer / Supplier / Karigar)
- **Action Key:** `create_party`
- **Business Purpose:** Register a new business contact (Customer, Supplier, Karigar, Employee) into the central ledger.
- **Required Permission:** `party:create`
- **Required Inputs:** `fullName`, `partyType` (mapped via Terminology Engine)
- **Optional Inputs:** `mobile`, `email`, `address`, `city`, `state`, `gstin`, `pan`, `contactPerson`, `creditTerms`, `preferredLanguage`
- **Conditional Inputs:** 
  - `openingCashBalance` (Requires `party:balance:edit`)
  - `openingGoldBalance` (Requires `party:balance:edit`)
- **Custom Fields Support:** Automatically dynamically resolves custom fields marked as required in Tenant Configuration.
- **Validation Service:** `PartySchema.parse()`, Duplicate Detection (Mobile/Name)
- **Draft Service:** `saveConversationalDraft('create_party')`
- **Posting Service:** `PartyService.createPerson()`
- **Confirmation Level:** High (Preview -> Confirm)
- **Audit Event:** `party_created_via_assistant`
- **Supported Input:** Text, Voice, Document Extract

## 2. Create Ready Stock
- **Action Key:** `create_ready_stock`
- **Business Purpose:** Inward new finished jewellery into ready inventory.
- **Required Permission:** `inventory:create`
- **Required Inputs:** `itemType`, `metal`, `purity`, `grossWeight`, `pieces`
- **Optional Inputs:** `stoneWeight`, `netWeight`, `tagNumber`, `location`, `images`
- **Conditional Inputs:**
  - `netWeight` (Required if stoneWeight > 0)
- **Validation Service:** `InventorySchema.parse()`, Fine Weight Deterministic Calculator
- **Posting Service:** `InventoryService.addItem()`
- **Confirmation Level:** Medium
- **Audit Event:** `ready_stock_added_via_assistant`
- **Supported Input:** Text, Voice, Image Upload

## 3. Create Expense
- **Action Key:** `create_expense`
- **Business Purpose:** Book a business expense into the accounting ledger.
- **Required Permission:** `expense:create`
- **Required Inputs:** `expenseCategory`, `amount`, `paymentMethod`
- **Optional Inputs:** `date`, `partyId`, `taxDetails`, `attachmentImage`
- **Validation Service:** `ExpenseSchema.parse()`
- **Posting Service:** `ExpenseService.addExpense()`
- **Confirmation Level:** Medium
- **Audit Event:** `expense_booked_via_assistant`
- **Supported Input:** Text, Voice, Invoice Image Upload

## 4. Create Order (Manufacturing Order)
- **Action Key:** `create_order`
- **Business Purpose:** Register a new customer order for manufacturing.
- **Required Permission:** `order:create`
- **Required Inputs:** `partyId`, `designReference`, `expectedWeight`, `metalPurity`
- **Optional Inputs:** `dueDate`, `specialInstructions`, `quantity`, `customerGoldMaterial`
- **Validation Service:** `OrderSchema.parse()`
- **Posting Service:** `OrderService.createOrder()`
- **Confirmation Level:** Medium
- **Supported Input:** Text, Voice, Reference Image

## 5. Create Job (Assign to Karigar)
- **Action Key:** `create_job`
- **Business Purpose:** Issue a work order to a Karigar (Worker).
- **Required Permission:** `job:create`
- **Required Inputs:** `orderId`, `karigarId`, `processType`
- **Optional Inputs:** `dueDate`
- **Validation Service:** `JobSchema.parse()`
- **Posting Service:** `JobService.assignJob()`
- **Confirmation Level:** Medium
- **Supported Input:** Text, Voice

## 6. Issue Gold (To Karigar / Outside Work)
- **Action Key:** `issue_gold`
- **Business Purpose:** Transfer raw material / gold to a worker for manufacturing.
- **Required Permission:** `gold:issue`
- **Required Inputs:** `karigarId`, `jobId`, `sourceVault`, `grossWeight`, `purity`
- **Validation Service:** Deterministic Fine Weight Calculation, Vault Balance Check
- **Posting Service:** `GoldLedgerService.issueMaterial()`
- **Confirmation Level:** High (Explicit Consent Required)
- **Supported Input:** Text, Voice

## 7. Receive Gold (From Karigar / Outside Work)
- **Action Key:** `receive_gold`
- **Business Purpose:** Receive finished or semi-finished items back from worker.
- **Required Permission:** `gold:receive`
- **Required Inputs:** `jobId`, `grossReceivedWeight`
- **Optional Inputs:** `stoneDeduction`, `lossWeight`, `scrapRecovery`
- **Validation Service:** Loss/Wastage Calculation, Reconciliation Engine
- **Posting Service:** `GoldLedgerService.receiveMaterial()`
- **Confirmation Level:** High (Explicit Consent Required)
- **Supported Input:** Text, Voice

## 8. Create Invoice
- **Action Key:** `create_invoice`
- **Business Purpose:** Generate a sales invoice for a customer.
- **Required Permission:** `invoice:create`
- **Required Inputs:** `partyId`, `itemsList`
- **Optional Inputs:** `applicableBhav`, `taxConfig`, `paymentTerms`
- **Validation Service:** Final calculation engine (deterministic)
- **Posting Service:** `InvoiceService.postInvoice()`
- **Confirmation Level:** High (Explicit Consent Required)
- **Supported Input:** Text, Voice

---
*This registry maps natural language intents to the strict schema requirements of the underlying Ornexa ERP. The Assistant will automatically read the tenant's configuration to append Custom Fields to these workflows.*
