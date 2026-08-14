# ORNEXA — MULTIMODAL ACTION ENGINE MASTER
**Specification for Document/Image Vision, Candidate Extraction, and Safe Transaction Drafts**
*Version: 4.0.0*

---

## 1. Operating Flow

```mermaid
graph TD
    Upload["User Uploads Image / PDF / Invoice"] --> Vision["Multimodal Analyzer & Candidate Extractor"]
    
    Vision --> Extract["Extract Vendor, Amount, GST, Gold Wt, Purity, Date"]
    Extract --> MatchParty["Match or Suggest Party (RLS Protected)"]
    
    MatchParty --> DraftGen["Generate Structured ERP Action Draft (Expense / Job / Purchase / Catalogue)"]
    DraftGen --> AccountingCheck["Validate GST Rates, Purity Conversions & Double-Entry Balance"]
    
    AccountingCheck --> VisualCard["Render Interactive Preview Card"]
    VisualCard --> UserConfirm{"User Clicks [ Confirm & Execute ]"}
    
    UserConfirm -->|Yes| LedgerPost["Deterministic ERP Service Posts Transaction"]
    LedgerPost --> Attach["Link Uploaded File as Official Attachment"]
    Attach --> Audit["Record in assistant_action_audit"]
    
    UserConfirm -->|No / Edit| Dismiss["Discard Draft (No DB mutation)"]
```

## 2. Supported Multimodal Scenarios

1. **Photo of Expense Receipt:** $\to$ Extracts payee, amount, 18% GST $\to$ Prepares Expense Draft $\to$ Posts to Financial Ledger upon confirmation.
2. **Photo of Bullion Supplier Bill:** $\to$ Extracts gross weight, 995/999 touch, 3% GST $\to$ Prepares Purchase Inward Voucher $\to$ Updates Vault Stock upon confirmation.
3. **Photo of Handwritten Job Card:** $\to$ Extracts customer order reference, karigar name, target gold weight $\to$ Prepares Manufacturing Job Draft $\to$ Issues metal upon confirmation.
4. **Photo of Jewellery Design / CAD:** $\to$ Extracts estimated weight and purity $\to$ Prepares Design Catalogue Record.
