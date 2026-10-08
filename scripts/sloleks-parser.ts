import {SaxesParser} from 'saxes';
import {Readable} from 'node:stream';
import {createReadStream} from 'node:fs';
import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import yauzl from 'yauzl';
export type WordRow={word:string;frequency:number;isLemma:boolean;solutionCandidate?:boolean};
export type Report={files:number;entries:number;orthographies:number;acceptedForms:number;uniqueWords:number;skippedEntries:number;skippedForms:number;properNames:number;solutionCandidates:number;norms:Record<string,number>};
type Node={name:string;attrs:Record<string,string>;text:string;children:Node[]};
const children=(node:Node|undefined,name:string)=>node?.children.filter(n=>n.name===name)||[];
function at(node:Node|undefined,...names:string[]):Node|undefined{for(const name of names)node=children(node,name)[0];return node;}
const value=(n:Node|undefined)=>n?.text.trim()||'';
const canonical=(s:string)=>s.normalize('NFC').trim().toLocaleUpperCase('sl-SI');
const alphabet=/^[ABCČDEFGHIJKLMNOPRSŠTUVZŽ]{5}$/;
function standard(norm:string|undefined){return !norm||norm==='standard';}
export function emptyReport():Report{return {files:0,entries:0,orthographies:0,acceptedForms:0,uniqueWords:0,skippedEntries:0,skippedForms:0,properNames:0,solutionCandidates:0,norms:{}};}
function extract(entry:Node,words:Map<string,WordRow>,report:Report){
  report.entries++;
  const head=at(entry,'head'),grammar=at(head,'grammar'),lemma=at(head,'headword','lemma');
  if(!head||!grammar||!lemma)throw new Error('Vnos nima pričakovane glave, slovnice ali leme. Preveri obliko XML.');
  const proper=children(grammar,'grammarFeature').some(n=>n.attrs.name==='type'&&value(n)==='proper');
  const category=value(at(grammar,'category'));
  const pronunciation=children(grammar,'subcategory').find(n=>n.attrs.type==='pronunciation');
  const lexicalType=at(head,'lexicalUnit')?.attrs.type;
  if(proper)report.properNames++;
  if(proper||['abbreviation','residual'].includes(category)||['Acronym','Abbreviation','Symbol'].includes(value(pronunciation))||!standard(lemma.attrs.norm)||(lexicalType&&lexicalType!=='single')){report.skippedEntries++;return;}
  for(const form of children(at(entry,'body','wordFormList'),'wordForm')){
    for(const orth of children(at(form,'formRepresentations','orthographyList'),'orthography')){
      report.orthographies++;
      const norm=orth.attrs.norm||'';
      if(norm)report.norms[norm]=(report.norms[norm]||0)+1;
      const text=value(at(orth,'form')),word=canonical(text);
      if(!alphabet.test(word)||!standard(norm)){report.skippedForms++;continue;}
      // Pogostosti iste pisne oblike se pri različnih MSD ponavljajo.
      // Vzamemo MAX, nikoli vsote, tudi med različnimi vnosi.
      const measures=children(at(orth,'measureList'),'measure').filter(n=>n.attrs.type==='frequency'&&n.attrs.source==='Gigafida 2.0');
      let frequency=0;
      for(const measure of measures){const n=Number(value(measure));if(Number.isSafeInteger(n)&&n>=0)frequency=Math.max(frequency,n);}
      const existing=words.get(word);
      const isLemma=word===canonical(value(lemma));
      const features=children(at(form,'grammarFeatureList'),'grammarFeature');
      const feature=(name:string)=>value(features.find(n=>n.attrs.name===name));
      const msd=value(children(form,'msd').find(n=>n.attrs.language==='sl'));
      // JOS: S=noun, o=common, position 3=number, position 4=case.
      // Osnovna množinska lema (VRATA/SANJE) lahko ostane kandidat.
      // Navadna množinska oblika (ZOBJE -> ZOB) ne ustreza lemi.
      const common=children(grammar,'grammarFeature').some(n=>n.attrs.name==='type'&&value(n)==='common')||msd.startsWith('So');
      const nominative=feature('case')==='nominative'||(/^So[mzs][em]i/.test(msd));
      const numberOK=['singular','plural'].includes(feature('number'))||(/^So[mzs][em]i/.test(msd));
      const solutionCandidate=category==='noun'&&common&&isLemma&&nominative&&numberOK;
      words.set(word,{word,frequency:Math.max(existing?.frequency||0,frequency),isLemma:!!existing?.isLemma||isLemma,solutionCandidate:!!existing?.solutionCandidate||solutionCandidate});
      report.acceptedForms++;
    }
  }
  report.uniqueWords=words.size;

}
export async function parseXML(stream:Readable,words:Map<string,WordRow>,report:Report){
  const parser=new SaxesParser({xmlns:false});
  let root='',entries=0,textSize=0;
  const parents:string[]=[],nodes:Node[]=[];
  parser.on('doctype',()=>{throw new Error('DOCTYPE ni dovoljen v uvozu.');});
  parser.on('opentag',tag=>{
    const name=tag.name.split(':').at(-1)!;
    if(!parents.length){root=name;if(root!=='lexicon')throw new Error('Pričakovan je korenski element <lexicon>.');}
    parents.push(name);
    if(parents.length>64)throw new Error('XML je pregloboko gnezden.');
    if((name==='entry'&&parents.length===2)||nodes.length){
      nodes.push({name,attrs:tag.attributes as Record<string,string>,text:'',children:[]});
    }
  });
  const text=(s:string)=>{if(nodes.length){textSize+=s.length;if(textSize>20_000_000)throw new Error('Posamezen vnos XML je prevelik.');nodes[nodes.length-1].text+=s;}};
  parser.on('text',text);parser.on('cdata',text);
  parser.on('closetag',()=>{
    if(nodes.length){const node=nodes.pop()!;if(nodes.length)nodes[nodes.length-1].children.push(node);else{extract(node,words,report);entries++;textSize=0;}}
    parents.pop();
  });
  stream.setEncoding('utf8');
  for await(const chunk of stream)parser.write(String(chunk));
  parser.close();
  if(root!=='lexicon'||!entries)throw new Error('XML ne vsebuje nobenega celotnega vnosa <entry>.');
  report.files++;
}
async function openZip(filename:string):Promise<yauzl.ZipFile>{return new Promise((resolve,reject)=>yauzl.open(filename,{lazyEntries:true,autoClose:false},(e,z)=>e?reject(e):resolve(z!)));}
async function zipEntries(zip:yauzl.ZipFile):Promise<yauzl.Entry[]>{
  return new Promise((resolve,reject)=>{
    const entries:yauzl.Entry[]=[];
    const fail=(e:Error)=>{cleanup();reject(e);};
    const entry=(e:yauzl.Entry)=>{if(/\.xml$/i.test(e.fileName)&&!/(^|\/)xml_schemas\//.test(e.fileName))entries.push(e);zip.readEntry();};
    const end=()=>{cleanup();resolve(entries.sort((a,b)=>a.fileName.localeCompare(b.fileName)));};
    const cleanup=()=>{zip.off('error',fail);zip.off('entry',entry);zip.off('end',end);};
    zip.on('error',fail);zip.on('entry',entry);zip.on('end',end);zip.readEntry();
  });
}
async function* directoryXML(dir:string):AsyncGenerator<string>{
  for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const file=path.join(dir,item.name);
    if(item.isDirectory()&&item.name!=='xml_schemas')yield* directoryXML(file);
    else if(item.isFile()&&/\.xml$/i.test(item.name))yield file;
  }
}
export async function readSloleks(input:string,onProgress:(message:string)=>void=console.log){
  const report=emptyReport(),words=new Map<string,WordRow>();
  const read=async(name:string,stream:Readable)=>{
    onProgress(`Berem ${name} …`);
    try{await parseXML(stream,words,report);}catch(e){stream.destroy();throw new Error(`${name}: ${e instanceof Error?e.message:String(e)}`);}
    onProgress(`  ${report.entries.toLocaleString('sl-SI')} vnosov; ${words.size.toLocaleString('sl-SI')} različnih petčrkovnih besed.`);
  };
  if((await stat(input)).isDirectory())for await(const file of directoryXML(input))await read(path.basename(file),createReadStream(file));
  else if(/\.zip$/i.test(input)){
    const zip=await openZip(input);
    try{
      for(const entry of await zipEntries(zip)){
        const stream=await new Promise<Readable>((resolve,reject)=>zip.openReadStream(entry,(e,s)=>e?reject(e):resolve(s!)));
        await read(entry.fileName,stream);
      }
    }finally{zip.close();}
  }else await read(path.basename(input),createReadStream(input));
  if(!report.files)throw new Error('Ni ustreznih XML datotek.');
  report.solutionCandidates=[...words.values()].filter(w=>w.solutionCandidate).length;
  return {report,words:[...words.values()].sort((a,b)=>a.word.localeCompare(b.word,'sl'))};
}
