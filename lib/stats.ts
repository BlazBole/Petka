import { GameView, ljubljanaDay, Mode } from './game';
export type Result = {id:string; mode:Mode; day:string; won:boolean; attempts:number};
export function addResult(results: Result[], game: GameView): Result[] {
  if (game.status === 'playing' || results.some(r => r.id === game.id)) return results;
  return [...results, {id:game.id, mode:game.mode, day:game.day, won:game.status==='won', attempts:game.guesses.length}];
}
export function summarize(results: Result[], mode: Mode, today = ljubljanaDay()) {
  const filtered = results.filter(r=>r.mode===mode);
  const wins = filtered.filter(r=>r.won);
  const distribution = Array.from({length:8},(_,i)=>wins.filter(r=>r.attempts===i+1).length);
  const daily = filtered.toSorted((a,b)=>a.day.localeCompare(b.day));
  let streak=0, best=0, previous='';
  for (const r of mode==='daily' ? daily : filtered) {
    const consecutive = mode==='unlimited' || !previous || Date.parse(r.day)-Date.parse(previous)===86400000;
    streak = r.won ? (consecutive ? streak+1 : 1) : 0;
    best=Math.max(best,streak); previous=r.day;
  }
  if(mode==='daily' && previous && Date.parse(today)-Date.parse(previous)>86400000) streak=0;
  return {played:filtered.length, wins:wins.length, rate:filtered.length?Math.round(100*wins.length/filtered.length):0, streak,best,distribution};
}
