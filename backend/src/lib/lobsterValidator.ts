/**
 * Regex-based pre-check that verifies input is a real Moltbook garbled math challenge
 * before calling the LLM. Rejects non-challenges to prevent LLM waste.
 */

// Alternating case pattern: tWeNtY fIvE, lObStEr, etc.
// Moltbook challenges have characteristic mixed-case obfuscation
const ALTERNATING_CASE_RE = /[a-z][A-Z][a-z]|[A-Z][a-z][A-Z]/;

// Lobster/marine theme keywords (case-insensitive, fuzzy to handle obfuscation)
// After lowercasing and stripping non-alpha chars
const MARINE_KEYWORDS = [
  'lobster', 'lobsters', 'claw', 'claws', 'newton', 'newtons',
  'neuton', 'neutons', 'nooton', 'nootons', 'neoton', 'neotons',
  'noton', 'notons', 'force', 'forces', 'creature', 'creatures',
  'armored', 'antenna', 'shell', 'swim', 'swims', 'swimming',
  'pebble', 'grip', 'grips', 'exerts', 'exert',
];

// Math operation indicators
const MATH_KEYWORDS = [
  'add', 'adds', 'plus', 'total', 'combined', 'sum', 'together',
  'subtract', 'minus', 'loses', 'lost', 'remains', 'remaining',
  'drops', 'reduced', 'net', 'left', 'less', 'slows',
  'multiply', 'multiplied', 'times', 'product', 'momentum', 'each',
  'divide', 'divided', 'split', 'per', 'acceleration', 'velocity',
  'force', 'speed', 'power',
];

// Number words
const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand',
];

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether the input looks like a Moltbook challenge.
 * Must pass at least 2 of 4 heuristics:
 * 1. Alternating case pattern
 * 2. Marine/lobster theme keywords
 * 3. Math operation keywords
 * 4. Number words or digits
 */
export function validateLobsterChallenge(input: string): ValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'Empty or non-string input' };
  }

  if (input.length < 20) {
    return { valid: false, reason: 'Challenge text too short (min 20 chars)' };
  }

  if (input.length > 2000) {
    return { valid: false, reason: 'Challenge text too long (max 2000 chars)' };
  }

  // Normalize for keyword matching
  const lower = input.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = lower.split(' ');

  let score = 0;

  // Heuristic 1: Alternating case pattern (strong signal for Moltbook obfuscation)
  if (ALTERNATING_CASE_RE.test(input)) {
    score += 1;
  }

  // Heuristic 2: Marine/lobster keywords (fuzzy — collapse repeated chars before matching)
  const collapsed = lower.replace(/(.)\1+/g, '$1');
  const collapsedWords = collapsed.split(' ');
  const hasMarineKeyword = MARINE_KEYWORDS.some(kw => {
    const kwCollapsed = kw.replace(/(.)\1+/g, '$1');
    return collapsedWords.some(w => w === kwCollapsed || w.includes(kwCollapsed));
  });
  if (hasMarineKeyword) {
    score += 1;
  }

  // Heuristic 3: Math operation keywords
  const hasMathKeyword = MATH_KEYWORDS.some(kw => {
    const kwCollapsed = kw.replace(/(.)\1+/g, '$1');
    return collapsedWords.some(w => w === kwCollapsed || w.includes(kwCollapsed));
  });
  if (hasMathKeyword) {
    score += 1;
  }

  // Heuristic 4: Number words or digits
  const hasNumberWord = NUMBER_WORDS.some(nw => {
    const nwCollapsed = nw.replace(/(.)\1+/g, '$1');
    return collapsedWords.some(w => w === nwCollapsed || w.includes(nwCollapsed));
  });
  const hasDigits = /\d/.test(input);
  if (hasNumberWord || hasDigits) {
    score += 1;
  }

  // Must pass at least 2 of 4 heuristics
  if (score < 2) {
    return {
      valid: false,
      reason: `Input does not look like a Moltbook challenge (score ${score}/4, need 2+)`,
    };
  }

  return { valid: true };
}
