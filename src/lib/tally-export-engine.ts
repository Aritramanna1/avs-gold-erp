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
export function generateTallyXML(
  vouchers: TallyVoucher[],
  companyName = "Ornexa Jewellery",
): string {
  /**
   * Second ledger name and which side (party vs. counter-ledger) is debited,
   * per voucher type — a Sale debits the party and credits Sales; a Purchase
   * credits the party (we owe them) and debits Purchase; a Receipt debits
   * Cash/Bank and credits the party (clearing their receivable); a Payment
   * debits the party and credits Cash/Bank. Getting this backwards posts
   * every purchase/receipt as a mirror-image sale, which is worse than not
   * exporting it at all.
   */
  function counterLedgerAndDebitSide(
    voucherType: TallyVoucher["voucherType"],
  ): { counterLedger: string; partyIsDebit: boolean } {
    switch (voucherType) {
      case "Sales":
        return { counterLedger: "Sales Account", partyIsDebit: true };
      case "Purchase":
        return { counterLedger: "Purchase Account", partyIsDebit: false };
      case "Receipt":
        return { counterLedger: "Cash/Bank Account", partyIsDebit: false };
      case "Payment":
        return { counterLedger: "Cash/Bank Account", partyIsDebit: true };
      case "Journal":
      default:
        return { counterLedger: "Gold Inventory Account", partyIsDebit: true };
    }
  }

  const xmlVouchers = vouchers
    .map((v) => {
      const amountRupees = (v.amountPaise / 100).toFixed(2);
      const fineGrams = v.fineGoldMg ? (v.fineGoldMg / 1000).toFixed(3) : "0.000";
      const { counterLedger, partyIsDebit } = counterLedgerAndDebitSide(v.voucherType);
      const partyAmount = partyIsDebit ? `-${amountRupees}` : amountRupees;
      const counterAmount = partyIsDebit ? amountRupees : `-${amountRupees}`;

      return `
    <VOUCHER VCHTYPE="${v.voucherType}" ACTION="Create">
      <DATE>${v.dateStr.replace(/-/g, "")}</DATE>
      <VOUCHERTYPENAME>${v.voucherType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${v.voucherNumber}</VOUCHERNUMBER>
      <NARRATION>${v.narration} (Fine Gold Wt: ${fineGrams}g)</NARRATION>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${v.partyName}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${partyIsDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${partyAmount}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${counterLedger}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${partyIsDebit ? "No" : "Yes"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${counterAmount}</AMOUNT>
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
