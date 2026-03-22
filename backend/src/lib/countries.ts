export const COUNTRIES: string[] = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macao',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Puerto Rico',
  'Qatar',
  'Republic of the Congo',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
];

// Case-insensitive lookup map: lowercase -> canonical form
const COUNTRY_MAP = new Map<string, string>();
for (const c of COUNTRIES) {
  COUNTRY_MAP.set(c.toLowerCase(), c);
}

// Map well-known cities, states, and regions to their country.
// Used as a fallback when the location string has no comma-separated country part.
const LOCATION_TO_COUNTRY = new Map<string, string>(Object.entries({
  // Nigeria
  'lagos': 'Nigeria', 'abuja': 'Nigeria', 'ibadan': 'Nigeria', 'kano': 'Nigeria',
  'port harcourt': 'Nigeria', 'benin city': 'Nigeria', 'kaduna': 'Nigeria',
  'enugu': 'Nigeria', 'warri': 'Nigeria', 'owerri': 'Nigeria', 'uyo': 'Nigeria',
  'calabar': 'Nigeria', 'abeokuta': 'Nigeria', 'ogun': 'Nigeria', 'oshogbo': 'Nigeria',
  'lekki': 'Nigeria', 'ikeja': 'Nigeria', 'yaba': 'Nigeria', 'surulere': 'Nigeria',
  'victoria island': 'Nigeria', 'ikoyi': 'Nigeria', 'ajah': 'Nigeria',
  'osun state': 'Nigeria', 'oyo state': 'Nigeria', 'lagos state': 'Nigeria',
  'rivers state': 'Nigeria', 'delta state': 'Nigeria', 'edo state': 'Nigeria',
  'kwara state': 'Nigeria', 'ondo state': 'Nigeria', 'ekiti state': 'Nigeria',
  'anambra state': 'Nigeria', 'imo state': 'Nigeria', 'abia state': 'Nigeria',
  'lekki lagos': 'Nigeria',
  // Ethiopia
  'addis ababa': 'Ethiopia', 'dire dawa': 'Ethiopia',
  // South Africa
  'johannesburg': 'South Africa', 'cape town': 'South Africa', 'durban': 'South Africa',
  'pretoria': 'South Africa', 'soweto': 'South Africa',
  'kwazulu-natal': 'South Africa', 'gauteng': 'South Africa',
  'western cape': 'South Africa', 'eastern cape': 'South Africa',
  // Kenya
  'nairobi': 'Kenya', 'mombasa': 'Kenya', 'kisumu': 'Kenya',
  // Ghana
  'accra': 'Ghana', 'kumasi': 'Ghana', 'tamale': 'Ghana',
  // Egypt
  'cairo': 'Egypt', 'alexandria': 'Egypt', 'giza': 'Egypt',
  // Philippines
  'manila': 'Philippines', 'cebu': 'Philippines', 'davao': 'Philippines',
  'quezon city': 'Philippines', 'makati': 'Philippines', 'taguig': 'Philippines',
  // India
  'mumbai': 'India', 'delhi': 'India', 'new delhi': 'India', 'bangalore': 'India',
  'bengaluru': 'India', 'hyderabad': 'India', 'chennai': 'India', 'kolkata': 'India',
  'pune': 'India',
  // Pakistan
  'karachi': 'Pakistan', 'lahore': 'Pakistan', 'islamabad': 'Pakistan',
  // Bangladesh
  'dhaka': 'Bangladesh', 'chittagong': 'Bangladesh',
  // United Kingdom
  'london': 'United Kingdom', 'manchester': 'United Kingdom', 'birmingham': 'United Kingdom',
  'edinburgh': 'United Kingdom', 'glasgow': 'United Kingdom', 'liverpool': 'United Kingdom',
  // United States
  'new york': 'United States', 'los angeles': 'United States', 'chicago': 'United States',
  'san francisco': 'United States', 'houston': 'United States', 'miami': 'United States',
  'seattle': 'United States', 'austin': 'United States', 'denver': 'United States',
  // Brazil
  'são paulo': 'Brazil', 'sao paulo': 'Brazil', 'rio de janeiro': 'Brazil',
  // Poland
  'warsaw': 'Poland', 'krakow': 'Poland', 'gdansk': 'Poland', 'gdynia': 'Poland',
  'wroclaw': 'Poland', 'poznan': 'Poland',
  // Germany
  'berlin': 'Germany', 'munich': 'Germany', 'hamburg': 'Germany', 'frankfurt': 'Germany',
  // France
  'paris': 'France', 'lyon': 'France', 'marseille': 'France',
  // Indonesia
  'jakarta': 'Indonesia', 'surabaya': 'Indonesia', 'bandung': 'Indonesia',
  // Turkey
  'istanbul': 'Turkey', 'ankara': 'Turkey', 'izmir': 'Turkey',
  // Cameroon
  'douala': 'Cameroon', 'yaoundé': 'Cameroon', 'yaounde': 'Cameroon',
  // Uganda
  'kampala': 'Uganda',
  // Tanzania
  'dar es salaam': 'Tanzania',
  // Rwanda
  'kigali': 'Rwanda',
  // Senegal
  'dakar': 'Senegal',
  // Morocco
  'casablanca': 'Morocco', 'rabat': 'Morocco', 'marrakech': 'Morocco',
  // Israel
  'tel aviv': 'Israel', 'jerusalem': 'Israel', 'haifa': 'Israel',
}))

/**
 * Normalize a raw country string extracted from a location field.
 */
export function normalizeCountry(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  // Strip parenthetical suffixes
  s = s.replace(/\s*\(.*\)\s*$/, '').trim();
  // Strip trailing punctuation
  s = s.replace(/[.,;]+$/, '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  // Direct country match
  if (COUNTRY_MAP.has(lower)) return COUNTRY_MAP.get(lower)!;
  // City/state/region fallback
  if (LOCATION_TO_COUNTRY.has(lower)) return LOCATION_TO_COUNTRY.get(lower)!;
  return s;
}

/**
 * Try to resolve a full location string (e.g. "Lekki Lagos" or "Abuja")
 * to a country. Checks the whole string first, then each comma-separated
 * part (last to first), then individual words.
 */
export function countryFromLocation(location: string): string {
  if (!location) return 'Unknown';
  // Try the full string
  const full = normalizeCountry(location);
  if (full && COUNTRY_MAP.has(full.toLowerCase())) return full;
  // Try each comma-separated part, last first (most likely to be country)
  const parts = location.split(',').map(s => s.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const norm = normalizeCountry(parts[i]);
    if (norm && COUNTRY_MAP.has(norm.toLowerCase())) return norm;
  }
  // Try city/region lookup on each part
  for (let i = parts.length - 1; i >= 0; i--) {
    const lower = parts[i].trim().toLowerCase().replace(/\s*\(.*\)\s*$/, '').replace(/[.,;]+$/, '').trim();
    if (LOCATION_TO_COUNTRY.has(lower)) return LOCATION_TO_COUNTRY.get(lower)!;
  }
  // Try individual words for multi-word locations without commas (e.g. "Lekki Lagos")
  if (parts.length === 1) {
    const words = location.trim().split(/\s+/);
    for (const word of words) {
      const lower = word.toLowerCase().replace(/[.,;]+$/, '');
      if (LOCATION_TO_COUNTRY.has(lower)) return LOCATION_TO_COUNTRY.get(lower)!;
    }
  }
  return 'Unknown';
}

/**
 * Map a country name to its continent for geographic diversity balancing.
 */
const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // Africa
  ...Object.fromEntries([
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
    'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros',
    'Congo', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt',
    'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia',
    'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho',
    'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania',
    'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
    'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone',
    'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo',
    'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
  ].map(c => [c, 'Africa'])),
  // Europe
  ...Object.fromEntries([
    'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina',
    'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia',
    'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland',
    'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg',
    'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia',
    'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia',
    'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine',
    'United Kingdom',
  ].map(c => [c, 'Europe'])),
  // Asia
  ...Object.fromEntries([
    'Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan',
    'Brunei', 'Cambodia', 'China', 'Georgia', 'India', 'Indonesia', 'Iran',
    'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan',
    'Laos', 'Lebanon', 'Malaysia', 'Maldives', 'Mongolia', 'Myanmar', 'Nepal',
    'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar',
    'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka', 'Syria',
    'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan',
    'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen',
  ].map(c => [c, 'Asia'])),
  // Americas
  ...Object.fromEntries([
    'Antigua and Barbuda', 'Argentina', 'Bahamas', 'Barbados', 'Belize',
    'Bolivia', 'Brazil', 'Canada', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
    'Dominica', 'Dominican Republic', 'Ecuador', 'El Salvador', 'Grenada',
    'Guatemala', 'Guyana', 'Haiti', 'Honduras', 'Jamaica', 'Mexico',
    'Nicaragua', 'Panama', 'Paraguay', 'Peru', 'Saint Kitts and Nevis',
    'Saint Lucia', 'Saint Vincent and the Grenadines', 'Suriname',
    'Trinidad and Tobago', 'United States', 'Uruguay', 'Venezuela',
  ].map(c => [c, 'Americas'])),
  // Oceania
  ...Object.fromEntries([
    'Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia',
    'Nauru', 'New Zealand', 'Palau', 'Papua New Guinea', 'Samoa',
    'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu',
  ].map(c => [c, 'Oceania'])),
};

export function continentFromCountry(country: string): string {
  return COUNTRY_TO_CONTINENT[country] ?? 'Other';
}
