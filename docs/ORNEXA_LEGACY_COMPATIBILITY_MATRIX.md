# Ornexa Legacy Compatibility Matrix

| Legacy Area                 | Status         | Notes                                                                    |
| --------------------------- | -------------- | ------------------------------------------------------------------------ |
| AVS online auth             | PRESERVED      | Do not restore obsolete local/offline auth bypasses.                     |
| Gold ledger                 | EXTENDED       | Existing gold ledger and customer ledger compilers are important.        |
| Worker/karigar transactions | EXTENDED       | Existing worker gold book and return flows map to manufacturing custody. |
| Universal print engine      | PRESERVED      | Must become the only semantic document path over time.                   |
| WhatsApp communications     | EXTENDED       | Existing providers and templates should be connected to workflow events. |
| Owner/platform console      | EXTENDED       | Must remain separate from tenant admin.                                  |
| Module hiding by bad state  | REGRESSION     | Navigation should not disappear from users due to stale frontend flags.  |
| Retail-heavy assumptions    | NEEDS_DECISION | Manufacturing-heavy behavior is the product direction.                   |
