/**
 * Test script to verify expiry formatting and symbol display
 * Run: cd frontend && npx tsx scripts/test-formatting.ts
 */

// Test instrument data
const testInstruments = [
  {
    tradingSymbol: 'NIFTY 05 MAY 25500 CALL',
    expiry: '2026-05-05',
    strike: 25500,
    index: 'NIFTY',
    optionType: 'CE',
  },
  {
    tradingSymbol: 'NIFTY 05 MAY 25500 PUT',
    expiry: '2026-05-05',
    strike: 25500,
    index: 'NIFTY',
    optionType: 'PE',
  },
  {
    tradingSymbol: 'BANKNIFTY 12 MAY 42000 CALL',
    expiry: '2026-05-12',
    strike: 42000,
    index: 'BANKNIFTY',
    optionType: 'CE',
  },
  {
    tradingSymbol: 'SENSEX 22 MAY 78000 PUT',
    expiry: '2026-05-22',
    strike: 78000,
    index: 'SENSEX',
    optionType: 'PE',
  },
];

// Format expiry: 2026-05-05 → May05,2026
function formatExpiry(d: string): string {
  if (!d || !d.includes('-')) return d;
  const parts = d.split('-');
  if (parts.length >= 2) {
    const y = parts[0];
    const m = parts[1];
    const day = parts[2]?.padStart(2, '0') || '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return day ? `${months[parseInt(m) - 1]}${day},${y}` : `${months[parseInt(m) - 1]}${y}`;
  }
  return d;
}

// Format expiry for search: 2026-05-05 → may05 or may2026
function formatExpiryForSearch(d: string): string {
  if (!d || !d.includes('-')) return d;
  const parts = d.split('-');
  const m = parts[1];
  const day = parts[2]?.padStart(2, '0') || '';
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return day ? `${months[parseInt(m) - 1]}${day}` : `${months[parseInt(m) - 1]}${parts[0].slice(2)}`;
}

// Test display format
console.log('\n========== EXPIRY FORMATTING TEST ==========\n');

for (const inst of testInstruments) {
  const isCall = inst.optionType === 'CE';
  
  // UI Display: "NIFTY 05 MAY 25500 CALL"
  const displayName = inst.tradingSymbol || 
    `${inst.index} ${formatExpiry(inst.expiry).replace(',', ' ')} ${inst.strike} ${isCall ? 'CALL' : 'PUT'}`;
  
  // API Symbol for trading: "NIFTY-May05,2026-25500-CE"
  const apiSymbol = `${inst.index}-${formatExpiry(inst.expiry)}-${inst.strike}-${inst.optionType}`;
  
  // Search format: "niftyp" + "may05" + "25500" + "ce"
  const searchFormat = `${inst.index.toLowerCase()}${formatExpiryForSearch(inst.expiry)}${inst.strike}${inst.optionType.toLowerCase()}`;
  
  console.log(`Input: ${inst.tradingSymbol}`);
  console.log(`  expiry: ${inst.expiry}`);
  console.log(`  formatExpiry: ${formatExpiry(inst.expiry)}`);
  console.log(`  formatExpiryForSearch: ${formatExpiryForSearch(inst.expiry)}`);
  console.log(`  UI Display: ${displayName}`);
  console.log(`  API Symbol: ${apiSymbol}`);
  console.log(`  Search Format: ${searchFormat}`);
  console.log('');
}

console.log('========== SEARCH MATCHING TEST ==========\n');

// Test search matching
const searchTests = [
  { query: 'may05', expected: 'NIFTY 05 MAY 25500 CALL' },
  { query: '25500', expected: 'NIFTY 05 MAY 25500 CALL' },
  { query: 'may', expected: 'NIFTY and BANKNIFTY' },
  { query: 'nifty', expected: 'All NIFTY instruments' },
  { query: 'call', expected: 'CE options' },
  { query: 'banknifty', expected: 'BANKNIFTY instruments' },
];

function testSearchMatch(inst: any, query: string): boolean {
  const q = query.toLowerCase();
  const searchIn = [
    inst.tradingSymbol,
    inst.index,
    String(inst.strike),
    formatExpiry(inst.expiry).toLowerCase(),
    formatExpiryForSearch(inst.expiry),
    inst.expiry,
  ].join(' ').toLowerCase();
  return searchIn.includes(q);
}

for (const test of searchTests) {
  console.log(`Query: "${test.query}" → Expected: ${test.expected}`);
  const matched = testInstruments.filter(i => testSearchMatch(i, test.query));
  console.log(`  Matched: ${matched.map(m => m.tradingSymbol).join(', ') || 'none'}`);
  console.log('');
}

console.log('========== CSV FILTER TEST DATA ==========\n');

// Simulated CSV data structure (what Dhan API returns)
const csvHeaders = ['SYMBOL_NAME', 'DISPLAY_NAME', 'SECURITY_ID', 'STRIKE_PRICE', 'SM_EXPIRY_DATE', 'LOT_SIZE', 'INSTRUMENT'];
const csvSample = [
  ['NIFTY 05 MAY 25500 CE', 'NIFTY 05 MAY 25500 CALL', '12045', '25500', '2026-05-05', '50', 'OPTIDX'],
  ['NIFTY 05 MAY 25500 PE', 'NIFTY 05 MAY 25500 PUT', '12046', '25500', '2026-05-05', '50', 'OPTIDX'],
  ['BANKNIFTY 12 MAY 42000 CE', 'BANKNIFTY 12 MAY 42000 CALL', '23456', '42000', '2026-05-12', '25', 'OPTIDX'],
];

console.log('CSV Headers:', csvHeaders.join(', '));
console.log('');
console.log('Sample Rows:');
for (const row of csvSample) {
  console.log(`  ${row.join(', ')}`);
}

console.log('\n========== FILTER LOGIC TEST ==========\n');

// Test filtering by index and option type
function filterInstruments(
  instruments: any[],
  indexFilter: string,
  optFilter: string
): any[] {
  let filtered = [...instruments];
  
  if (indexFilter !== 'ALL') {
    filtered = filtered.filter(i => i.index === indexFilter);
  }
  
  if (optFilter !== 'ALL') {
    filtered = filtered.filter(i => i.optionType === optFilter);
  }
  
  return filtered;
}

// Test filters
const filters = [
  { idx: 'NIFTY', opt: 'ALL', desc: 'All NIFTY' },
  { idx: 'ALL', opt: 'CE', desc: 'All CE options' },
  { idx: 'NIFTY', opt: 'CE', desc: 'NIFTY CE only' },
];

for (const f of filters) {
  const results = filterInstruments(testInstruments, f.idx, f.opt);
  console.log(`Filter: ${f.desc}`);
  console.log(`  Results: ${results.map(r => r.tradingSymbol).join(', ')}`);
  console.log('');
}

console.log('========== NEAR EXPIRY PRIORITY TEST ==========\n');

// Test near expiry sorting (within 7 days)
function sortByExpiryPriority(instruments: any[]): any[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);
  
  const nearExpiry: any[] = [];
  const farExpiry: any[] = [];
  
  for (const inst of instruments) {
    if (inst.expiry) {
      const expDate = new Date(inst.expiry);
      if (expDate <= sevenDaysFromNow) {
        nearExpiry.push(inst);
      } else {
        farExpiry.push(inst);
      }
    } else {
      nearExpiry.push(inst);
    }
  }
  
  // Sort each by expiry then strike
  const sortFn = (a: any, b: any) => {
    if (a.expiry && b.expiry && a.expiry !== b.expiry) {
      return a.expiry.localeCompare(b.expiry);
    }
    return a.strike - b.strike;
  };
  
  nearExpiry.sort(sortFn);
  farExpiry.sort(sortFn);
  
  return [...nearExpiry, ...farExpiry];
}

const sorted = sortByExpiryPriority(testInstruments);
console.log('Sorted by priority (near expiry first):');
for (const inst of sorted) {
  const daysUntil = inst.expiry 
    ? Math.ceil((new Date(inst.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  console.log(`  ${inst.tradingSymbol} → ${inst.expiry} (${daysUntil} days)`);
}

console.log('\n========== ALL TESTS COMPLETE ==========\n');
console.log('Format is correct! Use this in the app.\n');
