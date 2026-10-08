import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/game/route';
process.env.GAME_SECRET='test-secret-only-123456789012345678901234';
const req=(body:unknown,origin='http://localhost:3000')=>new NextRequest('http://localhost:3000/api/game',{method:'POST',headers:{'Content-Type':'application/json','host':'localhost:3000',origin},body:JSON.stringify(body)});
test('API vrne novo igro in namig, brez razkritja odgovora',async()=>{
  const first=await POST(req({action:'start',mode:'daily'}));assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'no-store');
  const game=await first.json();assert.equal(game.answer,undefined);assert.ok(game.token);
  const guess=await POST(req({action:'guess',token:game.token,word:'TRAVA'}));assert.equal(guess.status,200);assert.equal((await guess.json()).guesses.length,1);
});
test('API zavrne drug izvor in nepravilna telesa',async()=>{
  assert.equal((await POST(req({action:'start',mode:'daily'},'https://drug-izvor.si'))).status,403);
  assert.equal((await POST(req(null))).status,400);
  assert.equal((await POST(req({action:'start',mode:'wrong'}))).status,400);
  assert.equal((await POST(req({action:'guess',token:'invalid',word:'TRAVA'}))).status,410);
});
