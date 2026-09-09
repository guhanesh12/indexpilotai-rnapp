export interface DhanInstrument {
  Exch: string;
  ExchType: string;
  Symbol: string;
  TradingSymbol: string;
  SecurityId: string;
  StrikePrice: string;
  Expiry: string;
  LotSize: string;
  InstrumentType: string;
}

export function parseDhanCSV(csvText: string): DhanInstrument[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headerStr = lines[0];
  const header = headerStr.split(',').map(h => h.trim().replace(/"/g, ''));

  const data: DhanInstrument[] = [];
  const maxRows = 250000; // Full CSV coverage

  for (let i = 1; i < lines.length && i <= maxRows; i++) {
    try {
      const line = lines[i];
      const cells: string[] = [];
      let current = '';
      let inQuote = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          cells.push(current.trim().replace(/"/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim().replace(/"/g, ''));

      if (cells.length < header.length) continue;

      const row: any = {};
      for (let k = 0; k < Math.min(header.length, cells.length); k++) {
        row[header[k]] = cells[k] || '';
      }

      const inst: DhanInstrument = {
        Exch: row.EXCH_ID || row.Exch || '',
        ExchType: row.SEGMENT || row.ExchType || '',
        Symbol: row.SYMBOL_NAME || row.Symbol || '',
        TradingSymbol: row.DISPLAY_NAME || row.TradingSymbol || '',
        SecurityId: row.SECURITY_ID || row.SecurityId || '',
        StrikePrice: row.STRIKE_PRICE || row.StrikePrice || '0',
        Expiry: row.SM_EXPIRY_DATE || row.Expiry || '',
        LotSize: row.LOT_SIZE || row.LotSize || '1',
        InstrumentType: row.INSTRUMENT || row.INSTRUMENT_TYPE || row.InstrumentType || '',
      };

      if (inst.SecurityId && inst.Symbol) {
        data.push(inst);
      }
    } catch {
      // Skip
    }
  }

  console.log(`[CSVParser] Header sample: ${header.slice(0, 8).join(', ')}`);
  console.log(`[CSVParser] Parsed ${data.length}/${Math.min(lines.length-1, maxRows)} rows`);
  return data;
}

// Maximum options TOTAL across all indexes (16,000 as requested)
const MAX_OPTIONS_TOTAL = 16000;

export function filterOptions(instruments: DhanInstrument[]): {
  NIFTY: any[];
  BANKNIFTY: any[];
  SENSEX: any[];
} {
  const bundle: { NIFTY: any[]; BANKNIFTY: any[]; SENSEX: any[] } = { NIFTY: [], BANKNIFTY: [], SENSEX: [] };

  let nifty = 0, bank = 0, sensex = 0, optCount = 0;
  let loggedSample = false;

  // First pass: collect all options for each index
  const allOptions: { NIFTY: any[]; BANKNIFTY: any[]; SENSEX: any[] } = { NIFTY: [], BANKNIFTY: [], SENSEX: [] };

  instruments.forEach((inst) => {
    const symbol = (inst.Symbol || '').toUpperCase();
    const trad = (inst.TradingSymbol || '').toUpperCase();
    const instrType = (inst.InstrumentType || '').toUpperCase();
    const exchType = (inst.ExchType || '').toUpperCase();

    // OPTIDX/OP + NSE/NFO/D
    if (instrType === 'OPTIDX' || instrType === 'OP') {
      optCount++;
      if (!loggedSample) {
        console.log(`[Filter] Sample OPT exchType="${inst.ExchType}" symbol="${inst.Symbol}" trad="${inst.TradingSymbol}"`);
        loggedSample = true;
      }

      if ((exchType.includes('NSE') || exchType.includes('NFO') || exchType === 'D') && (
        (symbol.includes('NIFTY') || trad.includes('NIFTY')) ||
        (symbol.includes('BANKNIFTY') || trad.includes('BANKNIFTY')) || 
        (symbol.includes('SENSEX') || trad.includes('SENSEX'))
      )) {
        let index: 'NIFTY' | 'BANKNIFTY' | 'SENSEX' = 'NIFTY';
        if (symbol.includes('BANKNIFTY') || trad.includes('BANKNIFTY')) index = 'BANKNIFTY';
        else if (symbol.includes('SENSEX') || trad.includes('SENSEX')) index = 'SENSEX';

        const opt = {
          tradingSymbol: inst.TradingSymbol,
          displaySymbol: inst.Symbol,
          securityId: inst.SecurityId,
          strike: parseFloat(inst.StrikePrice) || 0,
          expiry: inst.Expiry,
          optionType: trad.includes('CE') || trad.includes('CALL') ? 'CE' : 'PE',
          lot: parseInt(inst.LotSize) || 1,
          exchange: inst.Exch,
          index,
        };

        allOptions[index].push(opt);

        if (index === 'NIFTY') nifty++;
        else if (index === 'BANKNIFTY') bank++;
        else sensex++;
      }
    }
  });

// Second pass: sort by expiry (nearest first) then strike, distribute 16,000 total across all 3 indexes
  const sortAndLimit = (opts: any[]): any[] => {
    // Sort by expiry (nearest first), then by strike (closest to ATM first)
    const byExpiry = opts.sort((a, b) => {
      if (a.expiry && b.expiry && a.expiry !== b.expiry) return a.expiry.localeCompare(b.expiry);
      return a.strike - b.strike;
    });
    return byExpiry;
  };

  // Get sorted options
  const sortedNifty = sortAndLimit(allOptions.NIFTY);
  const sortedBank = sortAndLimit(allOptions.BANKNIFTY);
  const sortedSensex = sortAndLimit(allOptions.SENSEX);

  // Calculate total available
  const totalAvailable = sortedNifty.length + sortedBank.length + sortedSensex.length;
  const targetTotal = Math.min(MAX_OPTIONS_TOTAL, totalAvailable);

  // Distribute proportionally: give each index its share of the 16,000 total
  const getProportionalLimit = (indexCount: number, total: number): number => {
    if (total === 0) return 0;
    return Math.floor((indexCount / total) * targetTotal);
  };

  // Apply limits proportional to each index's size
  const niftyLimit = getProportionalLimit(sortedNifty.length, totalAvailable);
  const bankLimit = getProportionalLimit(sortedBank.length, totalAvailable);
  // Remaining goes to SENSEX
  const sensexLimit = targetTotal - niftyLimit - bankLimit;

  bundle.NIFTY = sortedNifty.slice(0, niftyLimit);
  bundle.BANKNIFTY = sortedBank.slice(0, bankLimit);
  bundle.SENSEX = sortedSensex.slice(0, sensexLimit);

  console.log(`[Filter] OPT rows: ${optCount} | NIFTY:${bundle.NIFTY.length} BANKNIFTY:${bundle.BANKNIFTY.length} SENSEX:${bundle.SENSEX.length} (limited to ${targetTotal} total)`);
  return bundle;
}

