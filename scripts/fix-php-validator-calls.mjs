import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phpFile = path.join(root, 'public/api/mcp/index.php');

let php = fs.readFileSync(phpFile, 'utf8');

// Fix customer_gold_receipt validator call
const oldCustValidator = `            $rawP = $toolArgs['purity'] ?? 995;
            $cleanG = 0; $cleanPVal = 995; $cleanPStr = ""; $errC = 0; $errM = "";

            if (!validateWeightAndPurity($rawG, $rawP, $cleanG, $cleanPVal, $cleanPStr, $errC, $errM)) {
                http_response_code(400);
                echo json_encode([
                    "jsonrpc" => "2.0",
                    "id" => $id,
                    "error" => ["code" => $errC, "message" => $errM]
                ]);
                exit;
            }`;

const newCustValidator = `            $rawP = $toolArgs['purity'] ?? 995;
            $cleanG = 0; $cleanPVal = 995; $cleanPStr = ""; $errStruct = null;

            if (!validateWeightAndPurity($rawG, $rawP, $cleanG, $cleanPVal, $cleanPStr, $errStruct)) {
                http_response_code(400);
                echo json_encode([
                    "jsonrpc" => "2.0",
                    "id" => $id,
                    "error" => $errStruct
                ]);
                exit;
            }`;

php = php.replace(oldCustValidator, newCustValidator);

// Fix stock_generate_barcode_tag validator call
const oldStockValidator = `        case 'stock_generate_barcode_tag':
            $gross = floatval($toolArgs['grossWeightGrams'] ?? 0);
            $rawP = $toolArgs['purity'] ?? '22K';
            if (!validateWeightAndPurity($gross, $rawP, $cleanG, $cleanPVal, $cleanPStr, $errC, $errM)) {
                http_response_code(400);
                echo json_encode([
                    "jsonrpc" => "2.0",
                    "id" => $id,
                    "error" => ["code" => $errC, "message" => $errM]
                ]);
                exit;
            }`;

const newStockValidator = `        case 'stock_generate_barcode_tag':
            $gross = $toolArgs['grossWeightGrams'] ?? 0;
            $rawP = $toolArgs['purity'] ?? '22K';
            $cleanG = 0; $cleanPVal = 916; $cleanPStr = ""; $errStruct = null;
            if (!validateWeightAndPurity($gross, $rawP, $cleanG, $cleanPVal, $cleanPStr, $errStruct)) {
                http_response_code(400);
                echo json_encode([
                    "jsonrpc" => "2.0",
                    "id" => $id,
                    "error" => $errStruct
                ]);
                exit;
            }`;

php = php.replace(oldStockValidator, newStockValidator);

fs.writeFileSync(phpFile, php);
console.log('Successfully updated PHP validator calls in public/api/mcp/index.php');
