import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {emptyReport,parseXML,readSloleks,WordRow} from '../scripts/sloleks-parser';
const fixture=(file:string)=>fileURLToPath(new URL('./fixtures/'+file,import.meta.url));
test('ZIP se prebere po delih; filtrira imena, kratice, naglase in norm',async()=>{
  const {words,report}=await readSloleks(fixture('sloleks-small.zip'),()=>{});
  assert.deepEqual(words.map(w=>w.word).sort(),['TRAVA','TRAVE','VRATA','ŠOTOR'].sort());
  assert.equal(words.find(w=>w.word==='TRAVA')?.frequency,15);
  assert.equal(words.find(w=>w.word==='TRAVE')?.isLemma,false);
  assert.equal(words.find(w=>w.word==='ŠOTOR')?.isLemma,true);
  assert.equal(words.find(w=>w.word==='VRATA')?.frequency,0);
  assert.equal(report.files,2);assert.equal(report.entries,8);assert.equal(report.properNames,1);
  assert.equal(report.norms['unknown'],1);assert.equal(report.uniqueWords,4);
});
test('samostojen XML deluje; MSD pogostosti se ne seštevajo',async()=>{
  const {words}=await readSloleks(fixture('sloleks-a.xml'),()=>{});
  assert.equal(words.find(w=>w.word==='TRAVA')?.frequency,10);
});
test('odrezan vzorec, napačna struktura in DTD prekinejo obdelavo',async()=>{
  for(const xml of ['<lexicon><entry>','<wrong/>','<!DOCTYPE lexicon [<!ENTITY x "test">]><lexicon/>']){
    await assert.rejects(()=>parseXML(Readable.from([xml]),new Map<string,WordRow>(),emptyReport()));
  }
});
test('kandidati rešitev so občni samostalniki v osnovni imenovalniški obliki',async()=>{
  const entry=(lemma:string,word:string,category:string,msd:string)=>`<entry><head><headword><lemma>${lemma}</lemma></headword><lexicalUnit type="single"/><grammar><category>${category}</category><grammarFeature name="type">common</grammarFeature></grammar><measureList/></head><body><wordFormList><wordForm><msd language="sl" system="JOS">${msd}</msd><formRepresentations><orthographyList><orthography><form>${word}</form></orthography></orthographyList></formRepresentations></wordForm></wordFormList></body></entry>`;
  const xml='<lexicon>'+entry('trava','trava','noun','Sozei')+entry('trava','trave','noun','Sozer')+entry('vrata','vrata','noun','Sosmi')+entry('zob','zobje','noun','Sommi')+entry('imeti','imeti','verb','Ggnn')+entry('učiti','učiti','verb','Ggnn')+'</lexicon>';
  const words=new Map<string,WordRow>();await parseXML(Readable.from([xml]),words,emptyReport());
  assert.equal(words.get('TRAVA')?.solutionCandidate,true);
  assert.equal(words.get('VRATA')?.solutionCandidate,true);
  for(const word of ['TRAVE','ZOBJE','IMETI','UČITI'])assert.equal(words.get(word)?.solutionCandidate,false);
  // Pravilne oblike so še vedno dovoljene kot vnosi, ne kot naključne rešitve.
  assert.equal(words.size,6);
});
