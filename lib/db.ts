import { Pool } from 'pg';
const state = globalThis as unknown as { petkaPool?: Pool };
export function usesDatabase() { return process.env.WORD_SOURCE === 'postgres'; }
export function getPool(): Pool {
  if (!state.petkaPool) {
    if (!process.env.PGPASSWORD) throw new Error('Manjka PGPASSWORD. Preveri .env.');
    if ((process.env.PGDATABASE || 'petka') !== 'petka') throw new Error('Ta projekt uporablja samo podatkovno bazo petka.');
    state.petkaPool = new Pool({
      host:process.env.PGHOST || '127.0.0.1', port:Number(process.env.PGPORT || '55432'),
      database:'petka', user:process.env.PGUSER || 'petka', password:process.env.PGPASSWORD,
      max:5, connectionTimeoutMillis:5000, idleTimeoutMillis:30000,
      application_name:'petka',
    });
    state.petkaPool.on('error', error => console.error('Petka: povezava z bazo ni uspela:', error.message));
  }
  return state.petkaPool;
}
export async function closePool() { const p=state.petkaPool;state.petkaPool=undefined;if(p)await p.end(); }
