/**
 * Multi-Country & Multi-Currency Engine
 * Defines ISO-4217 currencies, ISO-3166 countries, formatting, decimals, and words in document currency.
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  majorUnit: string;
  minorUnit: string;
  decimals: number;
  format: 'indian' | 'standard';
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    majorUnit: 'Rupee',
    minorUnit: 'Paise',
    decimals: 2,
    format: 'indian',
  },
  AED: {
    code: 'AED',
    symbol: 'AED',
    name: 'UAE Dirham',
    majorUnit: 'UAE Dirham',
    minorUnit: 'Fils',
    decimals: 2,
    format: 'standard',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    majorUnit: 'US Dollar',
    minorUnit: 'Cent',
    decimals: 2,
    format: 'standard',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    majorUnit: 'Euro',
    minorUnit: 'Cent',
    decimals: 2,
    format: 'standard',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    majorUnit: 'Pound Sterling',
    minorUnit: 'Pence',
    decimals: 2,
    format: 'standard',
  },
  SAR: {
    code: 'SAR',
    symbol: 'SAR',
    name: 'Saudi Riyal',
    majorUnit: 'Saudi Riyal',
    minorUnit: 'Halala',
    decimals: 2,
    format: 'standard',
  },
  QAR: {
    code: 'QAR',
    symbol: 'QAR',
    name: 'Qatari Riyal',
    majorUnit: 'Qatari Riyal',
    minorUnit: 'Dirham',
    decimals: 2,
    format: 'standard',
  },
  OMR: {
    code: 'OMR',
    symbol: 'OMR',
    name: 'Omani Rial',
    majorUnit: 'Omani Rial',
    minorUnit: 'Baisa',
    decimals: 3,
    format: 'standard',
  },
  KWD: {
    code: 'KWD',
    symbol: 'KWD',
    name: 'Kuwaiti Dinar',
    majorUnit: 'Kuwaiti Dinar',
    minorUnit: 'Fils',
    decimals: 3,
    format: 'standard',
  },
  BHD: {
    code: 'BHD',
    symbol: 'BHD',
    name: 'Bahraini Dinar',
    majorUnit: 'Bahraini Dinar',
    minorUnit: 'Fils',
    decimals: 3,
    format: 'standard',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    majorUnit: 'Singapore Dollar',
    minorUnit: 'Cent',
    decimals: 2,
    format: 'standard',
  },
};

export type TaxRegime = 'IN_GST' | 'AE_VAT' | 'NONE';

export interface CountryConfig {
  code: string; // ISO-2
  name: string;
  currency: string;
  taxRegime: TaxRegime;
  phoneCode: string;
}

const COUNTRIES_MAP: Record<string, CountryConfig> = {
  IN: { code: 'IN', name: 'India', currency: 'INR', taxRegime: 'IN_GST', phoneCode: '+91' },
  AE: { code: 'AE', name: 'United Arab Emirates', currency: 'AED', taxRegime: 'AE_VAT', phoneCode: '+971' },
  US: { code: 'US', name: 'United States', currency: 'USD', taxRegime: 'NONE', phoneCode: '+1' },
  GB: { code: 'GB', name: 'United Kingdom', currency: 'GBP', taxRegime: 'NONE', phoneCode: '+44' },
  SA: { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', taxRegime: 'NONE', phoneCode: '+966' },
  QA: { code: 'QA', name: 'Qatar', currency: 'QAR', taxRegime: 'NONE', phoneCode: '+974' },
  OM: { code: 'OM', name: 'Oman', currency: 'OMR', taxRegime: 'NONE', phoneCode: '+968' },
  KW: { code: 'KW', name: 'Kuwait', currency: 'KWD', taxRegime: 'NONE', phoneCode: '+965' },
  BH: { code: 'BH', name: 'Bahrain', currency: 'BHD', taxRegime: 'NONE', phoneCode: '+973' },
  SG: { code: 'SG', name: 'Singapore', currency: 'SGD', taxRegime: 'NONE', phoneCode: '+65' },
  DE: { code: 'DE', name: 'Germany', currency: 'EUR', taxRegime: 'NONE', phoneCode: '+49' },
  FR: { code: 'FR', name: 'France', currency: 'EUR', taxRegime: 'NONE', phoneCode: '+33' },
  CA: { code: 'CA', name: 'Canada', currency: 'CAD', taxRegime: 'NONE', phoneCode: '+1' },
  AU: { code: 'AU', name: 'Australia', currency: 'AUD', taxRegime: 'NONE', phoneCode: '+61' },
  JP: { code: 'JP', name: 'Japan', currency: 'JPY', taxRegime: 'NONE', phoneCode: '+81' },
  CN: { code: 'CN', name: 'China', currency: 'CNY', taxRegime: 'NONE', phoneCode: '+86' },
  NL: { code: 'NL', name: 'Netherlands', currency: 'EUR', taxRegime: 'NONE', phoneCode: '+31' },
  CH: { code: 'CH', name: 'Switzerland', currency: 'CHF', taxRegime: 'NONE', phoneCode: '+41' },
  SE: { code: 'SE', name: 'Sweden', currency: 'SEK', taxRegime: 'NONE', phoneCode: '+46' },
  MY: { code: 'MY', name: 'Malaysia', currency: 'MYR', taxRegime: 'NONE', phoneCode: '+60' },
  NZ: { code: 'NZ', name: 'New Zealand', currency: 'NZD', taxRegime: 'NONE', phoneCode: '+64' },
  ZA: { code: 'ZA', name: 'South Africa', currency: 'ZAR', taxRegime: 'NONE', phoneCode: '+27' },
  BR: { code: 'BR', name: 'Brazil', currency: 'BRL', taxRegime: 'NONE', phoneCode: '+55' },
  MX: { code: 'MX', name: 'Mexico', currency: 'MXN', taxRegime: 'NONE', phoneCode: '+52' },
  ID: { code: 'ID', name: 'Indonesia', currency: 'IDR', taxRegime: 'NONE', phoneCode: '+62' },
  TH: { code: 'TH', name: 'Thailand', currency: 'THB', taxRegime: 'NONE', phoneCode: '+66' },
  PH: { code: 'PH', name: 'Philippines', currency: 'PHP', taxRegime: 'NONE', phoneCode: '+63' },
  VN: { code: 'VN', name: 'Vietnam', currency: 'VND', taxRegime: 'NONE', phoneCode: '+84' },
  BD: { code: 'BD', name: 'Bangladesh', currency: 'BDT', taxRegime: 'NONE', phoneCode: '+880' },
  LK: { code: 'LK', name: 'Sri Lanka', currency: 'LKR', taxRegime: 'NONE', phoneCode: '+94' },
  NP: { code: 'NP', name: 'Nepal', currency: 'NPR', taxRegime: 'NONE', phoneCode: '+977' },
  EG: { code: 'EG', name: 'Egypt', currency: 'EGP', taxRegime: 'NONE', phoneCode: '+20' },
  KE: { code: 'KE', name: 'Kenya', currency: 'KES', taxRegime: 'NONE', phoneCode: '+254' },
  NG: { code: 'NG', name: 'Nigeria', currency: 'NGN', taxRegime: 'NONE', phoneCode: '+234' },
  TR: { code: 'TR', name: 'Turkey', currency: 'TRY', taxRegime: 'NONE', phoneCode: '+90' },
  IE: { code: 'IE', name: 'Ireland', currency: 'EUR', taxRegime: 'NONE', phoneCode: '+353' },
  ES: { code: 'ES', name: 'Spain', currency: 'EUR', taxRegime: 'NONE', phoneCode: '+34' },
  IT: { code: 'IT', name: 'Italy', currency: 'EUR', taxRegime: 'NONE', phoneCode: '+39' },
};

export const COUNTRY_LIST: CountryConfig[] = Object.values(COUNTRIES_MAP);

// Hybrid array + dict allowing both COUNTRIES.map(...) and COUNTRIES['IN'] / COUNTRIES.IN
const createCountriesHybrid = (): CountryConfig[] & Record<string, CountryConfig> => {
  const arr = [...COUNTRY_LIST] as any;
  for (const [code, item] of Object.entries(COUNTRIES_MAP)) {
    arr[code] = item;
    arr[code.toLowerCase()] = item;
  }
  return arr;
};

export const COUNTRIES: CountryConfig[] & Record<string, CountryConfig> = createCountriesHybrid();

export const UAE_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];

export function getCurrencyConfig(code?: string | null): CurrencyConfig {
  const c = (code || 'INR').toUpperCase();
  return (
    CURRENCIES[c] || {
      code: c,
      symbol: c,
      name: c,
      majorUnit: c,
      minorUnit: 'Cent',
      decimals: 2,
      format: 'standard',
    }
  );
}

export function getCountryConfig(code?: string | null): CountryConfig {
  const c = (code || 'IN').toUpperCase();
  return (
    COUNTRIES[c] || {
      code: c,
      name: c,
      currency: 'USD',
      taxRegime: 'NONE',
      phoneCode: '',
    }
  );
}

/**
 * Format currency amount with appropriate decimal places and grouping
 * @param subunits integer in lowest unit (e.g. paise, fils, cents)
 * @param currencyCode ISO code (e.g. INR, USD, AED, KWD)
 * @param withSymbol whether to prefix the currency symbol
 */
export function formatCurrency(
  subunits: number | null | undefined,
  currencyCode = 'INR',
  withSymbol = true
): string {
  const conf = getCurrencyConfig(currencyCode);
  const val = Number(subunits ?? 0);
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);

  const divisor = Math.pow(10, conf.decimals);
  const mainUnits = Math.floor(abs / divisor);
  const rem = abs % divisor;
  const remStr = String(rem).padStart(conf.decimals, '0');

  let grouped: string;
  if (conf.format === 'indian') {
    const s = String(mainUnits);
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  } else {
    grouped = mainUnits.toLocaleString('en-US');
  }

  const symPrefix = withSymbol ? `${conf.symbol} ` : '';
  return `${sign}${symPrefix}${grouped}.${remStr}`;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsWords(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const t = TENS[Math.floor(n / 10)] ?? '';
  const o = n % 10;
  return o ? `${t}-${ONES[o]}` : t;
}

function threeDigitsWords(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) {
    if (h) parts.push(`and ${twoDigitsWords(r)}`);
    else parts.push(twoDigitsWords(r));
  }
  return parts.join(' ');
}

/** Standard International words system (Billions, Millions, Thousands) */
export function numberToInternationalWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const billion = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const million = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousand = Math.floor(n / 1_000);
  n %= 1_000;

  if (billion) parts.push(`${threeDigitsWords(billion)} Billion`);
  if (million) parts.push(`${threeDigitsWords(million)} Million`);
  if (thousand) parts.push(`${threeDigitsWords(thousand)} Thousand`);
  if (n) parts.push(threeDigitsWords(n));
  return parts.join(' ');
}

/** Indian words system (Crore, Lakh, Thousand) */
export function numberToIndianWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsWords(thousand)} Thousand`);
  if (n) parts.push(threeDigitsWords(n));
  return parts.join(' ');
}

/**
 * Format currency amount into words in the document currency
 * e.g. "UAE Dirhams One Thousand Five Hundred and Fifty Fils Only"
 * e.g. "US Dollars Two Thousand and Fifty Cents Only"
 * e.g. "Rupees Forty-Eight Thousand Only"
 */
export function currencyAmountInWords(
  amountSubunits: number | null | undefined,
  currencyCode = 'INR'
): string {
  const conf = getCurrencyConfig(currencyCode);
  const val = Math.abs(Math.round(Number(amountSubunits ?? 0)));
  const divisor = Math.pow(10, conf.decimals);
  const main = Math.floor(val / divisor);
  const sub = val % divisor;

  const wordsFn = conf.format === 'indian' ? numberToIndianWords : numberToInternationalWords;
  const mainWords = wordsFn(main);

  const majorLabel = main === 1 ? conf.majorUnit : (conf.majorUnit.endsWith('s') ? conf.majorUnit : `${conf.majorUnit}s`);
  const minorLabel = sub === 1 ? conf.minorUnit : (conf.minorUnit.endsWith('s') || conf.minorUnit === 'Paise' || conf.minorUnit === 'Pence' || conf.minorUnit === 'Baisa' ? conf.minorUnit : `${conf.minorUnit}s`);

  let result = `${majorLabel} ${mainWords}`;
  if (sub > 0) {
    const subWords = sub < 100 ? twoDigitsWords(sub) : threeDigitsWords(sub);
    result += ` and ${subWords} ${minorLabel}`;
  }
  return `${result} Only`;
}
