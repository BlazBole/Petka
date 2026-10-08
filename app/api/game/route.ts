import { NextRequest, NextResponse } from 'next/server';
import { GameError, guessGame, resumeGame, startGame } from '@/lib/server-game';
import { wordRepository } from '@/lib/words';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== req.headers.get('host')) return NextResponse.json({error:'Zahteva ni dovoljena.'},{status:403});
    if (Number(req.headers.get('content-length') || 0) > 16384) throw new GameError('Prevelika zahteva.');
    const raw = await req.text();
    if (raw.length > 16384) throw new GameError('Prevelika zahteva.');
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GameError('Neveljavna zahteva.');
    let result;
    if (body.action === 'start' && (body.mode === 'daily' || body.mode === 'unlimited')) {
      result = await startGame(body.mode, typeof body.previousToken === 'string' ? body.previousToken : undefined);
    } else if (body.action === 'resume' && typeof body.token === 'string') {
      result = resumeGame(body.token);
    } else if (body.action === 'guess' && typeof body.token === 'string' && typeof body.word === 'string') {
      result = await guessGame(body.token, body.word);
    } else throw new GameError('Neveljavna zahteva.');
    return NextResponse.json({...result,dictionary:await wordRepository.source()}, {headers:{'Cache-Control':'no-store'}});
  } catch (err) {
    if (err instanceof GameError) return NextResponse.json({error:err.message},{status:err.status});
    if (err instanceof SyntaxError) return NextResponse.json({error:'Neveljavna zahteva.'},{status:400});
    console.error('Petka API:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({error:'Igre trenutno ni mogoče naložiti. Poskusi znova.'},{status:500});
  }
}
