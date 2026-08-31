const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./firm-scoped-app-settings-Cc-xE3cx.js","./rolldown-runtime-aKtaBQYM.js","./data-provider-CkH2PLtZ.js","./client-CiQtz8B8.js","./vendor-jspdf-CCH8TJ7B.js","./vendor-supabase-Xe540gDR.js","./vendor-react-BbySHAOQ.js","./vendor-charts-Bv77YuA6.js"])))=>i.map(i=>d[i]);
import{r as e}from"./vendor-jspdf-CCH8TJ7B.js";import{t}from"./react-yId0ar3t.js";import{t as n}from"./data-provider-CkH2PLtZ.js";import{d as r}from"./settings-store-CA-ODQEu.js";import{t as i}from"./base-repository-DL_PfChB.js";import{u as a}from"./gold-DzJKbnHg.js";import{p as o}from"./billing-store-BeroIR92.js";import{c as s,m as c,r as l,s as u,u as d}from"./orders-store-Dko_o_hU.js";import{n as f,s as p}from"./jobcards-store-BmHRMDYX.js";import{n as m,o as h}from"./repair-store-DbqpIad3.js";import{l as g}from"./sequence-manager-7v2v7AeT.js";var _=i(`app_settings`),v={order_confirm:`Customer Order Confirmation`,order_ready:`Customer Order Ready`,payment_reminder:`Customer Payment Reminder`,delay_update:`Customer Delay Update`,repair_ready:`Repair Ready Message`,job_assignment:`Karigar Job Card Assignment`,work_reminder:`Karigar Work Reminder`,gold_issue_alert:`Karigar Gold Issue Alert`,work_receive_confirm:`Karigar Work Receive Confirmation`,daily_owner_summary:`Daily Owner Summary`,settlement_ready:`Settlement Ready for Review`,pending_settlement:`Pending Settlement Reminder`,custom:`Custom Message`},y={order_confirm:`customer`,order_ready:`customer`,payment_reminder:`customer`,delay_update:`customer`,repair_ready:`customer`,job_assignment:`karigar`,work_reminder:`karigar`,gold_issue_alert:`karigar`,work_receive_confirm:`karigar`,daily_owner_summary:`owner`,settlement_ready:`customer`,pending_settlement:`customer`,custom:`customer`},b={order_confirm:`Namaste {{customer_name}} ji,
Aapka order confirm ho gaya hai at {{firm_name}}.

Order No: {{order_number}}
Item: {{item_name}} ({{category}})
Purity: {{purity}}
Estimated Weight: {{gross_weight}}
Delivery Date: {{delivery_date}}

Dhanyavaad.
{{firm_name}} · {{firm_phone}}`,order_ready:`Namaste {{customer_name}} ji,
Aapka order {{order_number}} tayyar hai.
Item: {{item_name}} · {{gross_weight}} · {{purity}}
Kripya pickup karein.
{{firm_name}} · {{firm_phone}}`,payment_reminder:`Namaste {{customer_name}} ji,
Invoice {{invoice_number}} ka outstanding ₹ {{outstanding_amount}} hai.
Due Date: {{payment_due_date}}
Kripya payment kar dein.
{{firm_name}}`,delay_update:`Namaste {{customer_name}} ji,
Order {{order_number}} mein thoda samay lag raha hai.
Naya expected delivery: {{delivery_date}}
Asuvidha ke liye khed hai.
{{firm_name}}`,repair_ready:`Namaste {{customer_name}} ji,
Aapki repair {{repair_number}} tayyar hai.
Status: {{repair_status}}
Kripya pickup karein.
{{firm_name}} · {{firm_phone}}`,job_assignment:`Namaste {{karigar_name}} ji,
Naya job assigned from {{firm_name}}.

Job Card: {{job_card_number}}
Order: {{order_number}}
Item: {{item_name}} ({{category}})
Purity: {{purity}}
Target Gross: {{gross_weight}} · Fine: {{fine_weight}}
Delivery Date: {{delivery_date}}

Kripya work start karke status update karein.`,work_reminder:`Namaste {{karigar_name}} ji,
Job {{job_card_number}} ka status batayein.
Delivery: {{delivery_date}}`,gold_issue_alert:`Namaste {{karigar_name}} ji,
Aapko gold issue kiya gaya hai:
Job: {{job_card_number}} · Order: {{order_number}}
Gold Issued: {{gold_issued}} fine
Item: {{item_name}} · Purity: {{purity}}`,work_receive_confirm:`Namaste {{karigar_name}} ji,
Aapse work receive ho gaya:
Job: {{job_card_number}}
Gold Received: {{gold_received}} fine
Status: {{current_status}}
Dhanyavaad.`,daily_owner_summary:`{{firm_name}} — Daily Summary
Date: {{current_status}}
(Open Daily Close report for full numbers.)`,settlement_ready:`Namaste {{customer_name}} ji,
Aapka settlement {{settlement_number}} ready hai review ke liye.
Grand Total: {{invoice_amount}}
Kripya {{firm_name}} se sampark karein.
{{firm_name}} · {{firm_phone}}`,pending_settlement:`Namaste {{customer_name}} ji,
Aapka settlement {{settlement_number}} abhi bhi pending hai.
Outstanding: {{outstanding_amount}}
Kripya jald settlement complete karein.
{{firm_name}} · {{firm_phone}}`,custom:``};function x(){return typeof crypto<`u`&&`randomUUID`in crypto?crypto.randomUUID():`tpl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`}function S(){return[`order_confirm`,`order_ready`,`payment_reminder`,`delay_update`,`repair_ready`,`job_assignment`,`work_reminder`,`gold_issue_alert`,`work_receive_confirm`,`daily_owner_summary`,`custom`].map(e=>({id:`builtin_${e}`,kind:e,name:v[e],target:y[e],body:b[e],active:!0,isBuiltin:!0}))}var C=t()((t,r)=>{let i=async e=>{await _.saveAs(`whatsapp_templates`,{templates:e}),t({templates:e})};return{templates:[],refresh:async()=>{let r=await(await e(async()=>{let{resolveAppSettingsReadId:e}=await import(`./firm-scoped-app-settings-Cc-xE3cx.js`).then(e=>e.t);return{resolveAppSettingsReadId:e}},__vite__mapDeps([0,1,2,3,4,5,6,7]),import.meta.url)).resolveAppSettingsReadId(`whatsapp_templates`),{data:i,error:a}=await n.from(`app_settings`).select(`data`).eq(`id`,r).maybeSingle();if(a){console.error(`Error fetching whatsapp_templates:`,a);return}if(i&&i.data){let e=i.data;t({templates:e.templates||[]})}else t({templates:S()})},add:async e=>{let t={...e,id:x(),isBuiltin:!1};return await i([...r().templates,t]),t},update:async(e,t)=>{await i(r().templates.map(n=>n.id===e?{...n,...t}:n))},remove:async e=>{let t=r().templates.find(t=>t.id===e);!t||t.isBuiltin||await i(r().templates.filter(t=>t.id!==e))},resetToDefault:async e=>{let t=r().templates.find(t=>t.id===e);!t||!t.isBuiltin||await i(r().templates.map(t=>t.id===e?{...t,body:b[t.kind],active:!0}:t))},resetAll:async()=>{await i(S())}}}),w=`—`;function T(e){return e?`${a(e)} g`:w}function E(e){let t={},n=r.getState(),i=g.getState().people,a=c.getState().orders,_=p.getState().jobs,v=o.getState().invoices,y=h.getState().repairs;t.firm_name=n.firm.shopName,t.firm_phone=n.firm.phone||w,t.shop_address=n.firm.address||w;let b=e.orderId?a.find(t=>t.id===e.orderId):void 0,x=e.jobId?_.find(t=>t.id===e.jobId):b?_.find(e=>e.orderId===b.id):void 0,S=e.invoiceId?v.find(t=>t.id===e.invoiceId):b?v.find(e=>e.orderId===b.id):void 0,C=e.repairId?y.find(t=>t.id===e.repairId):void 0,E=e.customerId??b?.customerId??x?.customerId??S?.customerId??C?.customerId,D=e.karigarId??b?.karigarId??x?.karigarId,O=E?i.find(e=>e.id===E):void 0,k=D?i.find(e=>e.id===D):void 0;t.customer_name=O?.fullName??w,t.customer_phone=O?.phone??w,t.karigar_name=k?.fullName??w,t.karigar_phone=k?.phone??w,t.order_number=b?.orderNo??w,t.job_card_number=x?.jobNo??w;let A=b?u(b):[],j=b?s(b):null;return t.item_name=b?A.map(e=>e.quantity>1?`${e.quantity} × ${e.itemName}`:e.itemName).join(`, `)||w:x?.itemName??w,t.category=b?A[0]?.category??w:x?.category??w,t.purity=String(b?A[0]?.purity??w:x?.purity??w),t.gross_weight=T(j?j.grossMg:x?.targetGrossMg),t.net_weight=T(j?j.netMg:x?.targetNetMg),t.fine_weight=T(j?j.fineMg:x?.targetFineMg),t.item_count=String(b?A.length:1),t.delivery_date=b?.expectedDelivery??x?.expectedDelivery??w,t.due_date=t.delivery_date,t.invoice_number=S?.invoiceNo??w,t.invoice_amount=S?`₹ ${d(S.grandTotalPaise)}`:w,t.paid_amount=S?`₹ ${d(S.paidPaise)}`:w,t.outstanding_amount=S?`₹ ${d(S.balancePaise)}`:w,t.payment_due_date=S?new Date(S.createdAt+7*864e5).toISOString().slice(0,10):w,t.repair_number=C?.repairNo??w,t.repair_status=C?m[C.status]:w,t.gold_issued=w,t.gold_received=T(x?.workReceipt?.finishedFineMg),t.current_status=b?l[b.status]:x?f[x.status]:C?m[C.status]:new Date().toLocaleDateString(`en-IN`),t}var D=/\{\{\s*([a-z_]+)\s*\}\}/gi;function O(e,t){return e.replace(D,(e,n)=>{let r=t[n.toLowerCase()];return r!=null&&r!==``?r:w})}function k(e){let t=new Set,n=[];return e.replace(D,(e,r)=>{let i=r.toLowerCase();return t.has(i)||(t.add(i),n.push(i)),``}),n}export{v as a,b as i,O as n,C as o,k as r,E as t};