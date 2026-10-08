import './env';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readSloleks} from './sloleks-parser';
import {closePool} from '../lib/db';
import {storeImport} from '../lib/import-store';
async function main(){
  const args=process.argv.slice(2),dry=args.includes('--dry-run'),input=args.find(a=>!a.startsWith('--'));
  if(!input||args.some(a=>a.startsWith('--')&&a!=='--dry-run'))throw new Error('Uporaba: npm run import:sloleks -- "C:\\pot\\Sloleks.3.1.zip" [--dry-run]');
  // Celoten ZIP preberemo pred posegom v bazo. Poškodovan/truncated XML prekine uvoz.
  const {report,words}=await readSloleks(resolve(input));
  await mkdir('imports',{recursive:true});
  await writeFile('imports/report.json',JSON.stringify({source:'Sloleks 3.1',...report},null,2)+'\n');
  const ranked=words.toSorted((a,b)=>b.frequency-a.frequency||a.word.localeCompare(b.word,'sl'));
  const csv=(rows:typeof words)=>'\uFEFFword;frequency_max;is_lemma;solution_candidate\n'+rows.map(w=>`${w.word};${w.frequency};${w.isLemma};${!!w.solutionCandidate}`).join('\n')+'\n';
  await writeFile('imports/allowed-words.csv',csv(ranked));
  await writeFile('imports/candidates.csv',csv(ranked.filter(w=>w.solutionCandidate)));
  await copyFile(new URL('../SLOLEKS-NOTICE.txt',import.meta.url),'imports/SLOLEKS-NOTICE.txt');
  console.log('Poročilo:',report);console.log('Izpis: imports/report.json, imports/allowed-words.csv in imports/candidates.csv.');
  if(!words.length)throw new Error('Ni ustreznih besed za uvoz. Baza ni bila spremenjena.');
  if(dry){console.log('Pregled končan. Baza ni bila spremenjena.');return;}
  await storeImport(words,report);
  console.log(`Uspeh: uvoženih oziroma posodobljenih ${words.length} različnih besed. Potrjene rešitve in dnevni koledar so ohranjeni.`);
}
main().catch(e=>{console.error('Uvoz ni uspel:',e.message);process.exitCode=1;}).finally(closePool);
