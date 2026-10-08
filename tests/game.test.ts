import test from 'node:test';
import assert from 'node:assert/strict';
import {ljubljanaDay,scoreGuess} from '../lib/game';
import {addResult,summarize} from '../lib/stats';
import {guessGame,resumeGame,startGame} from '../lib/server-game';
import {solutions,wordRepository} from '../lib/words';
process.env.GAME_SECRET='test-secret-only-123456789012345678901234';
test('ponovljene črke ne presežejo razpoložljivih ujemanj',()=>{
  assert.deepEqual(scoreGuess('VRATA','TRASA'),{green:3,yellow:1,red:1});
  assert.deepEqual(scoreGuess('TRAVA','AAAAA'),{green:2,yellow:0,red:3});
  assert.deepEqual(scoreGuess('ŠOTOR','šotor'),{green:5,yellow:0,red:0});
  for(const answer of solutions)for(const guess of solutions){const c=scoreGuess(answer,guess);assert.equal(c.green+c.yellow+c.red,5);assert.ok(c.green>=0&&c.yellow>=0&&c.red>=0);}
});
test('slovenski datum okoli polnoči in prehoda ure',()=>{
  assert.equal(ljubljanaDay(new Date('2026-10-08T21:59:59Z')),'2026-10-08');
  assert.equal(ljubljanaDay(new Date('2026-10-08T22:00:00Z')),'2026-10-09');
  assert.equal(ljubljanaDay(new Date('2026-01-01T23:00:00Z')),'2026-01-02');
});
test('začetni seznam je veljaven in brez dvojnikov',async()=>{
  assert.equal(new Set(solutions).size,solutions.length);
  for(const word of solutions){assert.match(word,/^[A-ZČŠŽ]{5}$/);assert.ok(await wordRepository.isAllowed(word));}
});
test('dnevna igra je skupna, skrita in token zaščiten',async()=>{
  const a=await startGame('daily'),b=await startGame('daily');assert.equal(a.id,b.id);assert.equal(a.answer,undefined);
  assert.equal(resumeGame(a.token).id,a.id);
  assert.throws(()=>resumeGame(a.token.slice(0,-6)+'XXXXXX'));
  const aa=await guessGame(a.token,'TRAVA'),bb=await guessGame(b.token,'TRAVA');assert.deepEqual(aa.guesses,bb.guesses);
  await assert.rejects(()=>guessGame(aa.token,'TRAVA'));
  await assert.rejects(()=>guessGame(a.token,'XXXXX'));
});
test('zmaga, omejitev 8 poskusov in enkraten zapis statistike',async()=>{
  const start=await startGame('daily');let won;
  // Test ugotovi odgovor prek javnih poskusov; noben debug API ni v aplikaciji.
  for(const word of solutions){const g=await guessGame(start.token,word);if(g.status==='won'){won=g;break;}}
  assert.ok(won);assert.equal(won.answer,won.guesses[0].word);
  await assert.rejects(()=>guessGame(won.token,'TRAVA'));
  const results=addResult([],won);assert.equal(addResult(results,won).length,1);
  let lost=await startGame('daily');for(const w of solutions.filter(w=>w!==won.answer).slice(0,8))lost=await guessGame(lost.token,w);
  assert.equal(lost.status,'lost');assert.equal(lost.answer,won.answer);
  await assert.rejects(()=>guessGame(lost.token,'TRAVA'));
});
test('statistika loči načina in prekine dnevni niz',()=>{
  const r=[{id:'1',mode:'daily' as const,day:'2026-10-06',won:true,attempts:2},{id:'2',mode:'daily' as const,day:'2026-10-07',won:true,attempts:3},{id:'3',mode:'unlimited' as const,day:'2026-10-07',won:false,attempts:8}];
  assert.equal(summarize(r,'daily','2026-10-08').streak,2);
  assert.equal(summarize(r,'daily','2026-10-09').streak,0);
  assert.equal(summarize(r,'unlimited').played,1);
});
import {secondsUntilMidnight} from '../lib/game';
test('odštevanje upošteva premik na poletni in zimski čas',()=>{
  assert.equal(secondsUntilMidnight(new Date('2026-03-28T23:00:00Z')),23*3600);
  assert.equal(secondsUntilMidnight(new Date('2026-10-24T22:00:00Z')),25*3600);
});
