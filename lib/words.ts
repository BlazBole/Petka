// Strežniški repozitorij. Veljaven DATABASE način ob napaki ne preklopi tiho na demo.
import { createHmac, randomInt } from 'node:crypto';
import { getPool, usesDatabase } from './db';
import { normalizeWord } from './game';
import { demoRepository, solutions, approvedSolutions } from './demo-words';
export { solutions } from './demo-words';
export function demoDaily(day: string, secret: string): string {
  const ordered=[...solutions].sort((a,b)=>createHmac('sha256',secret).update(a).digest('hex').localeCompare(createHmac('sha256',secret).update(b).digest('hex')));
  return ordered[Math.floor(Date.parse(day+'T00:00:00Z')/86400000)%ordered.length];
}
export const wordRepository = {
  async isAllowed(word:string):Promise<boolean> {
    if(!usesDatabase())return demoRepository.isAllowed(word);
    const r=await getPool().query('SELECT 1 FROM petka.words WHERE word=$1 AND is_allowed',[normalizeWord(word)]);
    return r.rowCount===1;
  },
  async source():Promise<'demo'|'sloleks'|'curated'> {
    if(!usesDatabase())return 'demo';
    const r=await getPool().query('SELECT 1 FROM petka.imports LIMIT 1');
    return r.rowCount ? 'sloleks' : 'curated';
  },
  async random(previous?:string):Promise<string> {
    if(!usesDatabase()){
      const pool=approvedSolutions.filter(w=>w!==previous);return pool.length?pool[randomInt(pool.length)]:approvedSolutions[0];
    }
    const db=getPool();
    let r=await db.query<{word:string}>(`SELECT word FROM petka.words WHERE is_solution AND is_allowed AND ($1::text IS NULL OR word<>$1) ORDER BY random() LIMIT 1`,[previous||null]);
    if(!r.rowCount)r=await db.query<{word:string}>('SELECT word FROM petka.words WHERE is_solution AND is_allowed LIMIT 1');
    if(!r.rowCount)throw new Error('Ni potrjenih rešitev. Zaženi npm run db:init.');
    return r.rows[0].word;
  },
  async daily(day:string, secret:string):Promise<string> {
    if(!usesDatabase())return demoDaily(day,secret);
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('petka.daily.' || $1))",[day]);
      let r=await client.query<{word:string}>(`SELECT w.word FROM petka.daily_puzzles d JOIN petka.words w ON w.id=d.word_id WHERE d.day=$1::date`,[day]);
      if(!r.rowCount){
        // Najprej še neuporabljene rešitve, nato najdlje neuporabljene.
        r=await client.query<{word:string}>(`INSERT INTO petka.daily_puzzles(day,word_id)
          SELECT $1::date,w.id FROM petka.words w LEFT JOIN petka.daily_puzzles d ON d.word_id=w.id
          WHERE w.is_solution AND w.is_allowed GROUP BY w.id
          ORDER BY max(d.day) NULLS FIRST,random() LIMIT 1
          RETURNING (SELECT word FROM petka.words WHERE id=word_id) AS word`,[day]);
      }
      if(!r.rowCount)throw new Error('Ni potrjenih rešitev. Zaženi npm run db:init.');
      await client.query('COMMIT');return r.rows[0].word;
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  },
};
