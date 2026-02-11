// Shared safety filter — hard regex patterns and exit message used by both
// server.js and test-e2e.js. Catches clearly dangerous content before
// it reaches the LLM. Expanded to cover circumvention attempts while
// remaining narrow enough to avoid false positives on emotional distress.

export const SAFETY_PATTERNS = [
  // Direct violence toward specific targets.
  /\b(kill|murder|shoot|stab|strangle|choke)\s+(you|him|her|them|myself|everyone|myself)\b/i,
  // How-to harm queries.
  /\bhow\s+to\s+(kill|harm|hurt|poison|attack|injure|wound)\b/i,
  // Suicide methods and planning.
  /\b(suicide|suicidal)\s+(method|plan|how|way|ways|technique)\b/i,
  /\bhow\s+(to|do\s+i|can\s+i|should\s+i)\s+(cut|hang|overdose|end\s+it|end\s+my\s+life|jump|drown)\b/i,
  /\b(want|going|plan|planning|intend|trying)\s+to\s+(kill\s+myself|end\s+(my\s+)?life|die|commit\s+suicide)\b/i,
  // Self-harm instructions or encouragement.
  /\b(best|easiest|quickest|fastest|most\s+painless)\s+(way|method)\s+to\s+(die|end\s+it|kill)\b/i,
  /\bgive\s+me\s+(a\s+)?(method|way|plan)\s+to\s+(die|kill|harm|hurt)\b/i,
  // Sexually explicit content.
  /\b(nude|naked|sex|porn|pornograph|hentai|nsfw)\b/i,
  // Sexual violence and abuse.
  /\b(molest|rape|assault|grope|trafficking)\b/i,
  // Child exploitation.
  /\bchild\s+(abuse|porn|exploit|sex)\b/i,
  /\bminor[s]?\s+(sex|nude|naked|exploit)\b/i,
  // Drug manufacturing or acquisition instructions.
  /\bhow\s+to\s+(make|cook|synthesize|buy|get)\s+(meth|fentanyl|heroin|cocaine)\b/i,
  // Weapons creation.
  /\bhow\s+to\s+(make|build|assemble)\s+(a\s+)?(bomb|explosive|weapon|gun)\b/i,
];

export const SAFETY_EXIT_MESSAGE =
  "I want to step outside our conversation for a moment. What you've shared sounds serious, and you deserve real support from someone who can truly help. Please reach out to a crisis resource — you don't have to go through this alone.";

// Returns true if the text trips the hard safety filter.
export function checkSafety(text) {
  const lower = text.toLowerCase();
  return SAFETY_PATTERNS.some((pattern) => pattern.test(lower));
}
