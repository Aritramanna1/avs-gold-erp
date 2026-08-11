/**
 * AVS / ORNEXA ERP — Tally-Compatible XML & CSV Accounting Export Engine
 * Generates valid Tally ERP 9 / Tally Prime XML import payloads.
 */

export interface TallyVoucher {
  voucherNumber: string;
  dateStr: string; // YYYYMMDD for Tally
  voucherType: "Sales" | "Purchase" | "Receipt" | "Payment" | "Journal";
  partyName: string;
  amountPaise: number;
  fineGoldMg?: number;
  narration: string;
}

/**
 * Encodes vouchers into Tally XML Import Payload.
 */
export function generateTallyXML(vouchers: TallyVoucher[], companyName = "Ornexa Jewellery"): string {
  const xmlVouchers = vouchers
    .map((v) => {
      const amountRupees = (v.amountPaise / 100).toFixed(2);
      const fineGrams = v.fineGoldMg ? (v.fineGoldMg / 1000).toFixed(3) : "0.000";

      return `
    <VOUCHER VCHTYPE="${v.voucherType}" ACTION="Create">
      <DATE>${v.dateStr.replace(/-/g, "")}</DATE>
      <VOUCHERTYPENAME>${v.voucherType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${v.voucherNumber}</VOUCHERNUMBER>
      <NARRATION>${v.narration} (Fine Gold Wt: ${fineGrams}g)</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${v.partyName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>-${amountRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${v.voucherType === "Sales" ? "Sales Account" : "Gold Inventory Account"}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${amountRupees}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
    </VOUCHER>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${xmlVouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
