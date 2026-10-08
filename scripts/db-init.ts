import './env';
import {readFile} from 'node:fs/promises';
import {getPool,closePool} from '../lib/db';
import {allowed,approvedSolutions} from '../lib/demo-words';
import {demoDaily} from '../lib/words';
import {ljubljanaDay} from '../lib/game';
async function main(){
  const client=await getPool().connect();
  try{
    await client.query('BEGIN');
    await client.query(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
    const existing=await client.query('SELECT 1 FROM petka.words LIMIT 1');
    for(const word of allowed)await client.query(`INSERT INTO petka.words(word,is_solution,source) VALUES($1,$2,'Petka — začetni izbor') ON CONFLICT(word) DO NOTHING`,[word,approvedSolutions.includes(word)]);
    // Ob prvi vzpostavitvi ohranimo današnjo rešitev iz v1.0, če je ključ isti.
    if(!existing.rowCount){
      const day=ljubljanaDay();
      const secret=process.env.GAME_SECRET||'petka-development-only-secret-please-change';
      await client.query(`INSERT INTO petka.daily_puzzles(day,word_id) SELECT $1::date,id FROM petka.words WHERE word=$2 ON CONFLICT(day) DO NOTHING`,[day,demoDaily(day,secret)]);
    }
    await client.query('COMMIT');
    const r=await client.query('SELECT count(*) AS words,count(*) FILTER(WHERE is_solution AND is_allowed) AS solutions FROM petka.words');
    console.log('Baza petka je pripravljena:',r.rows[0]);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
main().catch(e=>{console.error('Inicializacija ni uspela:',e.message);process.exitCode=1;}).finally(closePool);
