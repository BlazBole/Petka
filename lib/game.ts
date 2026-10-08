export type Mode = 'daily' | 'unlimited';
export type Clue = { green: number; yellow: number; red: number };
export type Guess = { word: string; clue: Clue };
export type GameView = {
  dictionary?: 'demo'|'sloleks'|'curated'; id: string; mode: Mode; day: string; guesses: Guess[];
  status: 'playing' | 'won' | 'lost'; answer?: string; token: string;
};
export const MAX_GUESSES = 8;
export function normalizeWord(word: string) { return word.normalize('NFC').trim().toLocaleUpperCase('sl-SI'); }
export function scoreGuess(answer: string, guess: string): Clue {
  const target = Array.from(normalizeWord(answer));
  const input = Array.from(normalizeWord(guess));
  if (target.length !== 5 || input.length !== 5) throw new Error('Beseda mora imeti pet črk.');
  let green = 0, yellow = 0;
  const remaining = new Map<string, number>();
  target.forEach((letter, i) => {
    if (letter === input[i]) green++;
    else remaining.set(letter, (remaining.get(letter) || 0) + 1);
  });
  input.forEach((letter, i) => {
    if (letter === target[i]) return;
    const count = remaining.get(letter) || 0;
    if (count > 0) { yellow++; remaining.set(letter, count - 1); }
  });
  return { green, yellow, red: 5 - green - yellow };
}
export function ljubljanaDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Ljubljana', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function secondsUntilMidnight(date = new Date()): number {
  // Slovenija ima pozitiven UTC odmik. Odmik ob 00:00 UTC naslednjega datuma
  // je enak odmiku ob lokalni polnoči, tudi na dneve prehoda ure.
  const nextUTC = Date.parse(ljubljanaDay(date)+'T00:00:00Z')+86400000;
  const offset = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Ljubljana',hour:'2-digit',hourCycle:'h23'}).format(new Date(nextUTC)));
  return Math.max(0,Math.ceil((nextUTC-offset*3600000-date.getTime())/1000));
}
