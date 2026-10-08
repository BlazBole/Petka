import {getPool} from './db';
import type {WordRow,Report} from '../scripts/sloleks-parser';
export async function storeImport(words:WordRow[],report:Report){
  if(!words.length)throw new Error('Prazen uvoz ni dovoljen.');
  const client=await getPool().connect();
  try{
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('petka.sloleks-import'))");
    const marker=await client.query("SELECT value FROM petka.meta WHERE key='app'");
    if(marker.rows[0]?.value!=='petka')throw new Error('Najprej zaženi npm run db:init za bazo petka.');
    for(let i=0;i<words.length;i+=500){
      const batch=words.slice(i,i+500),params:unknown[]=[];
      const placeholders=batch.map((w,j)=>{params.push(w.word,w.frequency,w.isLemma,!!w.solutionCandidate);return `($${j*4+1},$${j*4+2}::bigint,$${j*4+3}::boolean,$${j*4+4}::boolean,'Sloleks 3.1')`;});
      await client.query(`INSERT INTO petka.words(word,frequency,is_lemma,is_solution_candidate,source) VALUES ${placeholders.join(',')}
        ON CONFLICT(word) DO UPDATE SET frequency=GREATEST(petka.words.frequency,EXCLUDED.frequency),is_lemma=petka.words.is_lemma OR EXCLUDED.is_lemma,is_solution_candidate=petka.words.is_solution_candidate OR EXCLUDED.is_solution_candidate,source=EXCLUDED.source`,params);
    }
    await client.query('INSERT INTO petka.imports(source,word_count,report) VALUES($1,$2,$3::jsonb)',['Sloleks 3.1',words.length,JSON.stringify(report)]);
    await client.query('COMMIT');

  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
