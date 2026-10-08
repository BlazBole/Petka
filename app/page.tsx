'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {BarChart3, BookOpen, CalendarDays, Check, ChevronRight, CircleHelp, Delete, Infinity as InfinityIcon, Menu, Sparkles, Trophy, X} from 'lucide-react';
import {GameView, ljubljanaDay, MAX_GUESSES, Mode, secondsUntilMidnight} from '@/lib/game';
import {addResult, Result, summarize} from '@/lib/stats';
type Panel = 'help' | 'stats' | 'result' | null;
const KEY='petka.v1';
function read<T,>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(`${KEY}.${key}`)||'null')??fallback;}catch{return fallback;}}
function save(key:string,value:unknown){try{localStorage.setItem(`${KEY}.${key}`,JSON.stringify(value));return true;}catch{return false;}}
async function request(body:unknown):Promise<GameView>{
  const res=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json(); if(!res.ok)throw new Error(data.error||'Povezava ni uspela. Poskusi znova.'); return data;
}
function Icon({name}:{name:'daily'|'unlimited'|'help'|'stats'}){const I={daily:CalendarDays,unlimited:InfinityIcon,help:BookOpen,stats:BarChart3}[name];return <I size={20} strokeWidth={1.7}/>;}
export default function Home(){
  const [mode,setMode]=useState<Mode>('daily'), [game,setGame]=useState<GameView|null>(null), [input,setInput]=useState('');
  const [panel,setPanel]=useState<Panel>(null),[menu,setMenu]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const [results,setResults]=useState<Result[]>([]),[statsMode,setStatsMode]=useState<Mode>('daily'),[today,setToday]=useState('');
  const [storageWarning,setStorageWarning]=useState(false),[now,setNow]=useState<Date|null>(null);
  const dialog=useRef<HTMLDialogElement>(null), lock=useRef(false),init=useRef(false), focusBefore=useRef<HTMLElement|null>(null);
  const commit=useCallback((g:GameView,persist=true)=>{
    setGame(g);setInput('');
    if(persist&&!save(g.mode,g))setStorageWarning(true);
    if(g.status!=='playing'){
      const old=read<Result[]>('results',[]);const next=addResult(Array.isArray(old)?old:[],g);
      if(next!==old)save('results',next);setResults(next);
    }
  },[]);
  const load=useCallback(async(target:Mode,fresh=false)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setInput('');setMenu(false);
    setMode(target);setGame(null);
    try{
      const stored=read<GameView|null>(target,null);
      const valid=stored?.token && stored.mode===target && (target==='unlimited'||stored.day===ljubljanaDay());
      let g:GameView; let resumed=false;
      if(valid&&!fresh){
        try{g=await request({action:'resume',token:stored.token});resumed=true;}
        catch(e){if(e instanceof Error && e.message.includes('potekla'))g=await request({action:'start',mode:target});else throw e;}
      }else g=await request({action:'start',mode:target,previousToken:stored?.token});
      commit(g,!resumed);
    }catch(e){setError(e instanceof Error?e.message:'Povezava ni uspela.');}
    finally{setBusy(false);lock.current=false;}
  },[commit]);
  useEffect(()=>{
    if(init.current)return;init.current=true;
    const stored=read<Result[]>('results',[]);setResults(Array.isArray(stored)?stored:[]);
    setToday(ljubljanaDay());setNow(new Date());
    if(!read('seen-help',false))setPanel('help');
    void load('daily');
  },[load]);
  useEffect(()=>{const timer=setInterval(()=>{setToday(ljubljanaDay());setNow(new Date());},1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    if(panel){focusBefore.current=document.activeElement as HTMLElement;dialog.current?.showModal();}
    else if(dialog.current?.open){dialog.current.close();focusBefore.current?.focus();}
  },[panel]);
  useEffect(()=>{
    const onStorage=(e:StorageEvent)=>{
      if(e.key===`${KEY}.results`){const r=read<Result[]>('results',[]);setResults(Array.isArray(r)?r:[]);}
      if(e.key===`${KEY}.${mode}`&&!lock.current)void load(mode);
    };window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage);
  },[mode,load]);
  function closePanel(){if(panel==='help')save('seen-help',true);setPanel(null);}
  const expired=!!game&&mode==='daily'&&!!today&&game.day!==today;
  const submit=useCallback(async()=>{
    if(!game||game.status!=='playing'||lock.current||expired)return;
    if(input.length!==5){setError('Potrebuješ še '+(5-input.length)+' '+(5-input.length===1?'črko.':'črke.'));return;}
    lock.current=true;setBusy(true);setError('');
    try{const g=await request({action:'guess',token:game.token,word:input});commit(g);if(g.status!=='playing')setPanel('result');}
    catch(e){setError(e instanceof Error?e.message:'Povezava ni uspela. Poskusi znova.');}
    finally{setBusy(false);lock.current=false;}
  },[game,input,expired,commit]);
  const keyPress=useCallback((key:string)=>{
    if(panel||menu||busy||!game||game.status!=='playing'||expired)return;
    setError('');
    if(key==='ENTER'){void submit();return;}
    if(key==='BACKSPACE'){setInput(v=>v.slice(0,-1));return;}
    if(/^[A-ZČŠŽ]$/.test(key))setInput(v=>v.length<5?v+key:v);
  },[panel,menu,busy,game,expired,submit]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      if((e.target as HTMLElement).matches('input,textarea,select'))return;
      if(e.key==='Enter' && (e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('.keyboard'))return;
      const key=e.key.toLocaleUpperCase('sl-SI');
      if(key==='BACKSPACE'||key==='ENTER'||/^[A-ZČŠŽ]$/.test(key)){if(!panel&&!menu)e.preventDefault();keyPress(key);}
    };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[keyPress,panel,menu]);
  const summary=summarize(results,statsMode,today||undefined);
  const complete=game&&game.status!=='playing';
  const dayLabel=game?new Intl.DateTimeFormat('sl-SI',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Ljubljana'}).format(new Date(game.day+'T12:00:00Z')):'Danes';
  function remaining(){if(!now)return '—';const sec=secondsUntilMidnight(now);return `${Math.floor(sec/3600).toString().padStart(2,'0')}:${Math.floor(sec%3600/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;}

  const navigation=<>
    <span className="nav-caption">TVOJ NASLEDNJI IZZIV</span>
    <button className={`nav-item ${mode==='daily'?'active':''}`} disabled={busy} onClick={()=>{setPanel(null);void load('daily');}}><Icon name="daily"/><span>Dnevni izziv<small>Ena beseda. Vsak dan.</small></span>{mode==='daily'&&<span className="nav-mark"/>}</button>
    <button className={`nav-item ${mode==='unlimited'?'active':''}`} disabled={busy} onClick={()=>{setPanel(null);void load('unlimited');}}><Icon name="unlimited"/><span>Neskončno<small>Še ena? Vedno.</small></span>{mode==='unlimited'&&<span className="nav-mark"/>}</button>
    <div className="nav-line"/>
    <button className="nav-item" onClick={()=>{setMenu(false);setPanel('help');}}><Icon name="help"/><span>Kako igrati</span></button>
    <button className="nav-item" onClick={()=>{setMenu(false);setStatsMode(mode);setPanel('stats');}}><Icon name="stats"/><span>Statistika</span></button>
  </>;
  return <div className="app-shell">
    <aside className="sidebar">
      <a href="/" className="brand" aria-label="Petka, začetna stran"><span className="brand-symbol">p<span/></span>petka<span className="brand-period">.</span></a>
      <p className="brand-sub">PET ČRK. TVOJA POTEZA.</p>
      <nav aria-label="Glavni meni">{navigation}</nav>
      <div className="sidebar-bottom"><div className="mini-score"><span>5</span><span>0</span><span>0</span></div><p>Malo besed.<br/>Veliko dobrih potez.</p><small>Slovenska besedna igra</small></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span className="desktop-label">BESEDNA TELOVADBA</span><a className="mobile-brand" href="/">petka<span>.</span></a><div className="header-actions"><span className="language">SL</span><button className="icon-button" aria-label="Kako igrati" onClick={()=>setPanel('help')}><CircleHelp size={21}/></button><button className="icon-button" aria-label="Statistika" onClick={()=>{setStatsMode(mode);setPanel('stats');}}><BarChart3 size={21}/></button><button className="icon-button menu-toggle" aria-label="Odpri meni" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>
      {menu&&<div className="mobile-menu"><nav aria-label="Mobilni meni">{navigation}</nav><button className="menu-dismiss" onClick={()=>setMenu(false)}>Zapri meni</button></div>}
      <main className="game-area">
        <div className="game-heading"><div><div className="eyebrow"><span className="pill">{mode==='daily'?'DNEVNI IZZIV':'BREZ OMEJITEV'}</span><span>{mode==='daily'?dayLabel:'Tvoj tempo. Tvoje besede.'}</span></div><h1>{mode==='daily'?'Današnjih pet.':'Samo še eno.'}</h1><p>Odkrij besedo. Sledi številkam.</p></div><div className="heading-icon">{mode==='daily'?<CalendarDays size={30}/>:<InfinityIcon size={34}/>}</div></div>
        <section className="board-section" aria-label="Igralna plošča" aria-busy={busy}>
          <div className="board-labels"><span>POSKUS {Math.min((game?.guesses.length||0)+(complete?0:1),8)} / 8</span><div><span title="Pravo mesto">✓</span><span title="Drugo mesto">↔</span><span title="Ni v besedi">×</span></div></div>
          <div className="board" role="list" aria-label="Osem poskusov">
            {Array.from({length:MAX_GUESSES},(_,i)=>{
              const guess=game?.guesses[i],active=!complete&&i===(game?.guesses.length||0),word=guess?.word||(active?input:'');
              return <div role="listitem" key={`${game?.id}-${i}`} className={`board-row ${active?'current':''} ${guess?'submitted':''} ${guess?.clue.green===5?'winning':''}`} aria-label={guess?`${i+1}. poskus: ${guess.word}, ${guess.clue.green} na pravem mestu, ${guess.clue.yellow} na drugem mestu, ${guess.clue.red} brez ujemanja`:`${i+1}. poskus, ${active?word||'vnesi besedo':'prazen'}`}>
                <div className="letters" aria-hidden="true">{Array.from({length:5},(_,j)=><span key={j} className={`letter ${word[j]?'filled':''} ${active&&j===word.length?'cursor':''}`}>{word[j]||''}</span>)}</div>
                <div className={`clues ${guess?'revealed':''}`} aria-hidden="true"><span className="green">{guess?.clue.green??'·'}</span><span className="yellow">{guess?.clue.yellow??'·'}</span><span className="red">{guess?.clue.red??'·'}</span></div>
              </div>;
            })}
          </div>
          <div className="board-message" role="status" aria-live="polite">{error?<span className="error">{error}</span>:busy?'Pripravljam igro …':expired?'Nov dan, nov izziv.':complete?(game.status==='won'?'Odlično! Pet pravih na pravem mestu.':'Dobra vaja. Naslednja beseda je nova priložnost.'):'Vsaka številka je nov namig.'}</div>
          {!game&&!busy&&<button className="primary retry" onClick={()=>void load(mode)}>Poskusi znova</button>}
          {expired?<button className="primary wide" onClick={()=>void load('daily',true)}>Odpri današnji izziv</button>:complete?<div className="completed-actions"><button className="primary" onClick={()=>mode==='unlimited'?void load(mode,true):void load('unlimited')}><InfinityIcon size={19}/>{mode==='unlimited'?'Nova beseda':'Igraj neskončno'}</button><button className="secondary" onClick={()=>setPanel('result')}>Rezultat</button></div>:<div className="keyboard" aria-label="Slovenska tipkovnica">
            {['ERTZUIOPŠŽ','ASDFGHJKLČ','CVBNM'].map((row,i)=><div className="key-row" key={row}>{i===2&&<button className="key key-enter" disabled={busy||!game} onClick={()=>keyPress('ENTER')} aria-label="Potrdi besedo"><Check size={18}/><span>Potrdi</span></button>}{Array.from(row).map(k=><button className="key" key={k} disabled={busy||!game} onClick={()=>keyPress(k)} aria-label={`Črka ${k}`}>{k}</button>)}{i===2&&<button className="key key-delete" disabled={busy||!game} onClick={()=>keyPress('BACKSPACE')} aria-label="Izbriši zadnjo črko"><Delete size={21}/></button>}</div>)}
          </div>}
        </section>
        <div className="legend"><span><i className="green"/>Pravo mesto</span><span><i className="yellow"/>Drugo mesto</span><span><i className="red"/>Brez ujemanja</span></div>
        <footer className="game-footer"><span>{mode==='daily'?'Ista beseda za vse. Nov izziv ob polnoči.':'Naključna beseda. Osem novih priložnosti.'}</span><span>Č, Š in Ž štejejo.</span></footer>
        <p className="demo-note">{game?.dictionary==='sloleks'?<>Slovar: <a href="https://www.clarin.si/repository/xmlui/handle/11356/2080" target="_blank" rel="noreferrer">Sloleks 3.1</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></>:'Začetni izbor · omejen slovar besed'}</p>
        {storageWarning&&<p className="error storage-warning">Brskalnik ne dovoli shranjevanja. Napredek in statistika se po zaprtju lahko izgubita.</p>}
      </main>
    </div>
    <dialog ref={dialog} className={`modal ${panel==='help'?'help-modal':''}`} onCancel={e=>{e.preventDefault();closePanel();}} onClick={e=>{if(e.target===dialog.current)closePanel();}} aria-labelledby="dialog-title">
      <div className="modal-content"><button className="modal-close icon-button" onClick={closePanel} aria-label="Zapri"><X size={21}/></button>
      {panel==='help'&&<><span className="modal-kicker">DOBRODOŠEL V PETKI</span><h2 id="dialog-title">Pet črk.<br/>Osem priložnosti.</h2><p className="modal-intro">Ugani slovensko besedo s petimi črkami. Za rešitve izbiramo običajne samostalnike v osnovni obliki. Po vsakem poskusu dobiš tri številke — katere črke se ujemajo, odkriješ sam.</p><div className="example"><div className="example-word">{'TRASA'.split('').map((l,i)=><span key={i}>{l}</span>)}</div><div className="example-clues"><span className="green">3</span><span className="yellow">1</span><span className="red">1</span></div></div><p className="example-caption">Če je rešitev <b>VRATA</b>, dobi poskus <b>TRASA</b>:</p><div className="help-rules"><div><span className="rule-number green">3</span><p><b>Na pravem mestu</b><span>Tri črke so na svojih mestih.</span></p></div><div><span className="rule-number yellow">1</span><p><b>Na drugem mestu</b><span>Ena črka je v besedi, a drugje.</span></p></div><div><span className="rule-number red">1</span><p><b>Brez ujemanja</b><span>Ena črka nima preostalega ujemanja.</span></p></div></div><div className="help-note"><Sparkles size={19}/><span>Vsaka črka v rešitvi šteje le enkrat. Če jo ponoviš prevečkrat, presežek šteje rdeče.</span></div><p className="small-copy">Uporabi tipkovnico ali gumbe spodaj. Č, Š in Ž so svoje črke. Lastna imena in kratice niso dovoljene. Sprejete so tudi oblike iz igralnega slovarja.</p>{game?.dictionary==='sloleks'&&<p className="small-copy">Besedni vir: Sloleks 3.1, Čibej, Jaka; Gantar, Kaja; Dobrovoljc, Kaja; Krek, Simon; Holozan, Peter; Erjavec, Tomaž; Romih, Miro; Arhar Holdt, Špela; Krsnik, Luka; Robnik-Šikonja, Marko. CJVT UL, 2026. Prilagoditev: izbor petčrkovnih oblik, filtriranje in združevanje dvojnikov za Petko. <a href="https://www.clarin.si/repository/xmlui/handle/11356/2080" target="_blank" rel="noreferrer">Vir</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.</p>}<button className="primary wide" onClick={closePanel}>Razumem, igrajmo!</button></>}
      {panel==='stats'&&<><span className="modal-kicker">VSAKA POTEZA ŠTEJE</span><h2 id="dialog-title">Tvoja statistika.</h2><div className="segmented"><button className={statsMode==='daily'?'selected':''} onClick={()=>setStatsMode('daily')}>Dnevni izziv</button><button className={statsMode==='unlimited'?'selected':''} onClick={()=>setStatsMode('unlimited')}>Neskončno</button></div><div className="stat-grid"><div><strong>{summary.played}</strong><span>Odigranih</span></div><div><strong>{summary.rate}<small>%</small></strong><span>Zmag</span></div><div><strong>{summary.streak}</strong><span>Trenutni niz</span></div><div><strong>{summary.best}</strong><span>Najboljši niz</span></div></div><h3>Poskusi do zmage</h3><div className="distribution">{summary.distribution.map((n,i)=><div key={i}><span>{i+1}</span><div><b style={{width:`${Math.max(7,n/Math.max(1,...summary.distribution)*100)}%`}} className={n?'has-wins':''}>{n}</b></div></div>)}</div>{!summary.played&&<p className="empty-copy">Prva odigrana igra bo začetek tvoje statistike.</p>}<p className="small-copy">Statistika se hrani samo v tem brskalniku. Izbris podatkov jo ponastavi. {statsMode==='daily'?'Niz pomeni zaporedne dneve z zmago.':'Niz pomeni zaporedne zmage v neskončnem načinu.'}</p></>}
      {panel==='result'&&game&&<><div className={`result-icon ${game.status==='won'?'victory':''}`}>{game.status==='won'?<Trophy size={34}/>:<Sparkles size={34}/>}</div><span className="modal-kicker">{game.status==='won'?'PET OD PET':'DOBRA BESEDNA VADBA'}</span><h2 id="dialog-title">{game.status==='won'?(game.guesses.length<=3?'Kapo dol!':'Bravo, uspelo ti je!'):'Naslednja bo tvoja.'}</h2><p className="modal-intro">{game.status==='won'?`Besedo si odkril v ${game.guesses.length}. poskusu.`:'Vsak poskus šteje. Poskusi znova z novo besedo.'}</p><div className="answer-label">ISKANA BESEDA</div><div className="result-answer">{game.answer?.split('').map((l,i)=><span key={i}>{l}</span>)}</div>{mode==='daily'&&<div className="countdown"><span>Naslednji dnevni izziv</span><strong>{expired?'Na voljo!':remaining()}</strong></div>}<button className="primary wide" disabled={busy} onClick={()=>{closePanel();void load('unlimited',mode==='unlimited');}}><InfinityIcon size={20}/>{mode==='daily'?'Nadaljuj v neskončnem načinu':'Nova beseda'}</button><button className="text-button" onClick={()=>{setStatsMode(mode);setPanel('stats');}}>Poglej statistiko <ChevronRight size={17}/></button></>}
      </div>
    </dialog>
  </div>;
}
