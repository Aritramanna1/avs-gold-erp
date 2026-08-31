import fs from 'fs';
import path from 'path';

const frozenAssetsDir = 'c:/final erp 29.08/avs-erp-cvse73i6/dist-erp/assets';
const editableAssetsDir = 'c:/final erp 29.08/new and final/dist/assets';

const frozenFiles = fs.readdirSync(frozenAssetsDir);
const editableFiles = fs.readdirSync(editableAssetsDir);

console.log('Frozen asset files count:', frozenFiles.length);
console.log('Editable asset files count:', editableFiles.length);

const normalizeName = (name) => name.replace(/-[A-Za-z0-9_-]+\.(js|css)$/, '');

const frozenNames = new Set(frozenFiles.map(normalizeName));
const editableNames = new Set(editableFiles.map(normalizeName));

const inFrozenNotEditable = Array.from(frozenNames).filter(x => !editableNames.has(x));
const inEditableNotFrozen = Array.from(editableNames).filter(x => !frozenNames.has(x));

console.log('\n--- In Frozen but NOT in Editable (' + inFrozenNotEditable.length + ') ---');
console.log(inFrozenNotEditable);

console.log('\n--- In Editable but NOT in Frozen (' + inEditableNotFrozen.length + ') ---');
console.log(inEditableNotFrozen);
