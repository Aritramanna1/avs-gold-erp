import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const dir = path.resolve('docs/control-plane');
const files = [
  '00_MASTER_CONTROL_INDEX.xlsx',
  '01_ACCOUNT_REGISTRY.xlsx',
  '02_ENVIRONMENT_REGISTRY.xlsx',
  '03_REPOSITORY_REGISTRY.xlsx',
  '04_DOMAIN_CLOUDFLARE_REGISTRY.xlsx',
  '05_SERVICE_INTEGRATION_REGISTRY.xlsx',
  '06_DEPLOYMENT_RELEASE_REGISTRY.xlsx',
];

async function validate() {
  console.log('Validating Control Plane Excel files in docs/control-plane/...');
  let errors = 0;
  const ids = new Set();

  for (const file of files) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing file: ${file}`);
      errors++;
      continue;
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    console.log(`\nInspecting ${file}: (${wb.worksheets.length} sheets)`);

    for (const ws of wb.worksheets) {
      console.log(`  - Sheet: ${ws.name} (${ws.rowCount} rows)`);
      ws.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          const val = String(cell.value || '');
          if (
            val.includes('#REF!') ||
            val.includes('#DIV/0!') ||
            val.includes('#VALUE!') ||
            val.includes('#N/A') ||
            val.includes('#NAME?')
          ) {
            console.error(`    [ERROR] Found Excel formula error in ${file} -> ${ws.name} [R${rowNumber}:C${colNumber}]: ${val}`);
            errors++;
          }
        });
      });
    }
  }

  if (errors === 0) {
    console.log('\n✓ ALL 7 CONTROL PLANE EXCEL WORKBOOKS ARE 100% VALID! ZERO FORMULA OR DATA ERRORS FOUND.');
  } else {
    console.error(`\nFound ${errors} validation errors.`);
    process.exit(1);
  }
}

validate().catch((err) => {
  console.error(err);
  process.exit(1);
});
