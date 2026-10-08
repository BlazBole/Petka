import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { GameView, Guess, Mode, ljubljanaDay, MAX_GUESSES, normalizeWord, scoreGuess } from './game';
import { wordRepository } from './words';
type Session = { v: 1; id: string; mode: Mode; day: string; answer: string; guesses: Guess[]; expires: number };
function secret() {
  const value = process.env.GAME_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('GAME_SECRET mora imeti vsaj 32 znakov.');
  return 'petka-development-only-secret-please-change';
}
function key() { return createHmac('sha256', secret()).update('petka-encryption-v1').digest(); }
function seal(session: Session) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
function open(token: string): Session {
  try {
    if (token.length > 10000) throw new Error();
    const b = Buffer.from(token, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key(), b.subarray(0,12));
    cipher.setAuthTag(b.subarray(12,28));
    const s = JSON.parse(Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString()) as Session;
    if (s.v !== 1 || s.expires < Date.now()) throw new Error();
    return s;
  } catch { throw new GameError('Shranjena igra je potekla. Začni novo igro.', 410); }
}
function view(s: Session): GameView {
  const won = s.guesses.at(-1)?.clue.green === 5;
  const status = won ? 'won' : s.guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  return { id:s.id, mode:s.mode, day:s.day, guesses:s.guesses, status, ...(status !== 'playing' ? {answer:s.answer} : {}), token:seal(s) };
}
export class GameError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function startGame(mode: Mode, previousToken?: string): Promise<GameView> {
  const day = ljubljanaDay();
  let answer: string;
  if (mode === 'daily') answer = await wordRepository.daily(day, secret());
  else {
    let previous: string | undefined;
    if (previousToken) { try { previous = open(previousToken).answer; } catch {} }
    answer = await wordRepository.random(previous);
  }
  return view({v:1, id:mode === 'daily' ? `daily:${day}` : randomUUID(), mode, day, answer, guesses:[], expires:Date.now()+366*86400000});
}
export function resumeGame(token: string) { return view(open(token)); }
export async function guessGame(token: string, input: string): Promise<GameView> {
  const s = open(token);
  if (s.mode === 'daily' && s.day !== ljubljanaDay()) throw new GameError('Začel se je nov dan. Odpri današnji izziv.', 409);
  if (view(s).status !== 'playing') throw new GameError('Ta igra je že zaključena.');
  const word = normalizeWord(input);
  if (!/^[A-ZČŠŽ]{5}$/.test(word)) throw new GameError('Vnesi slovensko besedo s petimi črkami.');
  if (!await wordRepository.isAllowed(word)) throw new GameError('Te besede ni v igralnem slovarju. Poskusi drugo.');
  if (s.guesses.some(g => g.word === word)) throw new GameError('To besedo si že poskusil.');
  s.guesses.push({word, clue:scoreGuess(s.answer, word)});
  return view(s);
}
