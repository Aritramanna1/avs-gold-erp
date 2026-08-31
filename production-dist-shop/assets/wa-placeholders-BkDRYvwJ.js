import{t as e}from"./react-yId0ar3t.js";import{t}from"./data-provider-BiPx7OEV.js";import{d as n}from"./settings-store-DiwQ4HQN.js";import{n as r}from"./base-repository-1Sjs6oXY.js";import{u as i}from"./gold-CgCimYBV.js";import{p as a}from"./billing-store-CQFeCkVB.js";import{c as o,d as s,h as c,l,r as u}from"./orders-store-oGiNAsDB.js";import{r as d,s as f}from"./jobcards-store-CvEG1VwD.js";import{n as p,o as m}from"./repair-store-DCgfnd4q.js";import{l as h}from"./sequence-manager-DdUdLYQX.js";var g=r(`app_settings`),_={order_confirm:`Customer Order Confirmation`,order_ready:`Customer Order Ready`,payment_reminder:`Customer Payment Reminder`,delay_update:`Customer Delay Update`,repair_ready:`Repair Ready Message`,job_assignment:`Karigar Job Card Assignment`,work_reminder:`Karigar Work Reminder`,gold_issue_alert:`Karigar Gold Issue Alert`,work_receive_confirm:`Karigar Work Receive Confirmation`,daily_owner_summary:`Daily Owner Summary`,settlement_ready:`Settlement Ready for Review`,pending_settlement:`Pending Settlement Reminder`,custom:`Custom Message`},v={order_confirm:`customer`,order_ready:`customer`,payment_reminder:`customer`,delay_update:`customer`,repair_ready:`customer`,job_assignment:`karigar`,work_reminder:`karigar`,gold_issue_alert:`karigar`,work_receive_confirm:`karigar`,daily_owner_summary:`owner`,settlement_ready:`customer`,pending_settlement:`customer`,custom:`customer`},y={order_confirm:`Namaste {{customer_name}} ji,
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
{{firm_name}} · {{firm_phone}}`,custom:``};function b(){return typeof crypto<`u`&&`randomUUID`in crypto?crypto.randomUUID():`tpl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`}function x(){return[`order_confirm`,`order_ready`,`payment_reminder`,`delay_update`,`repair_ready`,`job_assignment`,`work_reminder`,`gold_issue_alert`,`work_receive_confirm`,`daily_owner_summary`,`custom`].map(e=>({id:`builtin_${e}`,kind:e,name:_[e],target:v[e],body:y[e],active:!0,isBuiltin:!0}))}var S=e()((e,n)=>{let r=async t=>{await g.saveAs(`whatsapp_templates`,{templates:t}),e({templates:t})};return{templates:[],refresh:async()=>{let{data:n,error:r}=await t.from(`app_settings`).select(`data`).eq(`id`,`whatsapp_templates`).maybeSingle();if(r){console.error(`Error fetching whatsapp_templates:`,r);return}if(n&&n.data){let t=n.data;e({templates:t.templates||[]})}else e({templates:x()})},add:async e=>{let t={...e,id:b(),isBuiltin:!1};return await r([...n().templates,t]),t},update:async(e,t)=>{await r(n().templates.map(n=>n.id===e?{...n,...t}:n))},remove:async e=>{let t=n().templates.find(t=>t.id===e);!t||t.isBuiltin||await r(n().templates.filter(t=>t.id!==e))},resetToDefault:async e=>{let t=n().templates.find(t=>t.id===e);!t||!t.isBuiltin||await r(n().templates.map(t=>t.id===e?{...t,body:y[t.kind],active:!0}:t))},resetAll:async()=>{await r(x())}}}),C=`—`;function w(e){return e?`${i(e)} g`:C}function T(e){let t={},r=n.getState(),i=h.getState().people,g=c.getState().orders,_=f.getState().jobs,v=a.getState().invoices,y=m.getState().repairs;t.firm_name=r.firm.shopName,t.firm_phone=r.firm.phone||C,t.shop_address=r.firm.address||C;let b=e.orderId?g.find(t=>t.id===e.orderId):void 0,x=e.jobId?_.find(t=>t.id===e.jobId):b?_.find(e=>e.orderId===b.id):void 0,S=e.invoiceId?v.find(t=>t.id===e.invoiceId):b?v.find(e=>e.orderId===b.id):void 0,T=e.repairId?y.find(t=>t.id===e.repairId):void 0,E=e.customerId??b?.customerId??x?.customerId??S?.customerId??T?.customerId,D=e.karigarId??b?.karigarId??x?.karigarId,O=E?i.find(e=>e.id===E):void 0,k=D?i.find(e=>e.id===D):void 0;t.customer_name=O?.fullName??C,t.customer_phone=O?.phone??C,t.karigar_name=k?.fullName??C,t.karigar_phone=k?.phone??C,t.order_number=b?.orderNo??C,t.job_card_number=x?.jobNo??C;let A=b?o(b):[],j=b?l(b):null;return t.item_name=b?A.map(e=>e.quantity>1?`${e.quantity} × ${e.itemName}`:e.itemName).join(`, `)||C:x?.itemName??C,t.category=b?A[0]?.category??C:x?.category??C,t.purity=String(b?A[0]?.purity??C:x?.purity??C),t.gross_weight=w(j?j.grossMg:x?.targetGrossMg),t.net_weight=w(j?j.netMg:x?.targetNetMg),t.fine_weight=w(j?j.fineMg:x?.targetFineMg),t.item_count=String(b?A.length:1),t.delivery_date=b?.expectedDelivery??x?.expectedDelivery??C,t.due_date=t.delivery_date,t.invoice_number=S?.invoiceNo??C,t.invoice_amount=S?`₹ ${s(S.grandTotalPaise)}`:C,t.paid_amount=S?`₹ ${s(S.paidPaise)}`:C,t.outstanding_amount=S?`₹ ${s(S.balancePaise)}`:C,t.payment_due_date=S?new Date(S.createdAt+7*864e5).toISOString().slice(0,10):C,t.repair_number=T?.repairNo??C,t.repair_status=T?p[T.status]:C,t.gold_issued=C,t.gold_received=w(x?.workReceipt?.finishedFineMg),t.current_status=b?u[b.status]:x?d[x.status]:T?p[T.status]:new Date().toLocaleDateString(`en-IN`),t}var E=/\{\{\s*([a-z_]+)\s*\}\}/gi;function D(e,t){return e.replace(E,(e,n)=>{let r=t[n.toLowerCase()];return r!=null&&r!==``?r:C})}function O(e){let t=new Set,n=[];return e.replace(E,(e,r)=>{let i=r.toLowerCase();return t.has(i)||(t.add(i),n.push(i)),``}),n}export{_ as a,y as i,D as n,S as o,O as r,T as t};