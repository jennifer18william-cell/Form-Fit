import { getCategoryDiagnostics } from '../src/services/fashionImageService.ts';

const CATEGORIES_TO_TEST = [
  'mens-fashion',
  'womens-fashion',
  'kids-fashion',
  'unisex',
  'tshirts',
  'hoodies',
  'bottom-wear',
  'custom-studio',
  'hero-campaign',
  'lifestyle',
];

console.log('--- FORM & FIT: CATEGORY IMAGE REGRESSION TEST ---');

let hasError = false;
const seenUrls = new Map<string, string>();

for (const categoryKey of CATEGORIES_TO_TEST) {
  const diag = getCategoryDiagnostics(categoryKey);

  if (!diag.hasCategoryFallback) {
    console.error(`FAIL: Category "${categoryKey}" has no fallback mapping defined.`);
    hasError = true;
    continue;
  }

  if (!diag.primaryImageUrl) {
    console.error(`FAIL: Category "${categoryKey}" has no primary image URL.`);
    hasError = true;
    continue;
  }

  // Check for accidental duplicate image reuse across distinct categories
  if (seenUrls.has(diag.primaryImageUrl)) {
    const existingCat = seenUrls.get(diag.primaryImageUrl);
    console.error(
      `FAIL: Category "${categoryKey}" shares identical primary image URL (${diag.primaryImageUrl}) with category "${existingCat}".`
    );
    hasError = true;
  } else {
    seenUrls.set(diag.primaryImageUrl, categoryKey);
    console.log(`PASS: Category "${categoryKey}" -> ${diag.primaryImageUrl}`);
  }
}

if (hasError) {
  console.error('\nResult: REGRESSION TEST FAILED');
  process.exit(1);
} else {
  console.log(`\nResult: REGRESSION TEST PASSED (${CATEGORIES_TO_TEST.length} categories verified unique & valid)`);
  process.exit(0);
}
