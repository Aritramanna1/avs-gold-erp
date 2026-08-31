import fs from "fs";
function loadEnv(p){const o={};if(!fs.existsSync(p))return o;for(const line of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)o[m[1]]=m[2].replace(/^"|"$/g,"");}return o;}
const env={...loadEnv(".env.local")};
const url=env.VITE_SUPABASE_URL, key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
const body={
  p_doc_type:"tax_invoice",
  p_doc_number:"TEST-1",
  p_record_id:"00000000-0000-0000-0000-000000000001",
  p_business_name:"Test",
  p_party_label:null,
  p_invoice_date:"2026-01-01",
  p_total_paise:100,
  p_item_summary:"test",
  p_ttl_hours:24,
  p_document_share_token:null
};
const res=await fetch(url+"/rest/v1/rpc/mint_invoice_verification",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(body)});
console.log("mint", res.status, (await res.text()).slice(0,300));
const g=await fetch(url+"/rest/v1/rpc/get_gold_ledger_page",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_bucket:null,p_purity:null,p_type:null,p_from:null,p_to:null,p_limit:1,p_offset:0})});
console.log("gold_page", g.status, (await g.text()).slice(0,200));
