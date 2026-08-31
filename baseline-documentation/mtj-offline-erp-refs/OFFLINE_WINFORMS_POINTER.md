# Offline WinForms ERP — behaviour reference ONLY

Path (host machine, NOT part of production runtime):
  C:\avs-test-install\03-offline-winforms-erp

Rules:
- Reference for MTJ/Offline business behaviour mapping only.
- NEVER treat as authoritative production data plane.
- Production authority remains Supabase-backed Ornexa / AVS Gold ERP.
- fineGoldMg locked: round(grossMg × purityPermille / 999); default selected purity 995.
