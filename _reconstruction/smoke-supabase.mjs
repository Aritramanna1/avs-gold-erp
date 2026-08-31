import fs from "fs";
function loadEnv(p){const o={};if(!fs.existsSync(p))return o;for(const line of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)o[m[1]]=m[2].replace(/^"|"$/g,"");}return o;}
const env={...loadEnv(".env.local")};
const url=env.VITE_SUPABASE_URL, key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
const probes=[
  ["verify_public_document",{p_token:"test"}],
  ["get_public_website_bundle",{}],
  ["get_platform_trial_days",{}],
  ["mint_invoice_verification",{p_doc_type:"tax_invoice",p_doc_number:"T1",p_record_id:"00000000-0000-0000-0000-000000000001",p_business_name:"T",p_party_label:null,p_invoice_date:"2026-01-01",p_total_paise:1,p_item_summary:"x",p_ttl_hours:24,p_document_share_token:null}],
  ["get_gold_ledger_page",{p_bucket:null,p_purity:null,p_type:null,p_from:null,p_to:null,p_limit:1,p_offset:0}],
  ["get_company_cash_ledger_page",{p_account_id:null,p_party_id:null,p_source:null,p_from:null,p_to:null,p_limit:1,p_offset:0}],
  ["get_my_memberships",{p_product_id:"ORNEXA"}],
  ["set_active_tenant_context",{p_organization_id:"00000000-0000-0000-0000-000000000000",p_product_id:"ORNEXA"}],
];
async function run(n){
  const rows=[];
  for(const [name,body] of probes){
    const res=await fetch(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const text=await res.text();
    const present = res.status!==404 || !text.includes("PGRST202");
    // refine: 200/401/403/400 = present; PGRST202 = missing overload
    let verdict="PRESENT";
    if(res.status===404 && text.includes("PGRST202")) verdict="MISSING_OR_BAD_ARGS";
    if(res.status>=200 && res.status<300) verdict="OK";
    rows.push({name,status:res.status,verdict,snippet:text.slice(0,80)});
  }
  console.log("SUPABASE ROUND", n, JSON.stringify(rows,null,2));
}
await run(1); await run(2); await run(3);
