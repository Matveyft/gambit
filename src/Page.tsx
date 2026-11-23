"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Chess, type Square, type Color } from "chess.js";

type Game = { id:string, version:number, side:Color|null, base:number, inc:number, started:boolean, turn:Color, fen:string, log:{san:string,from:string,to:string}[], time:{w:number,b:number}, result:string|null, host:Color };
type Mark = "clock"|"link"|"rotate"|"settings"|"flag"|"copy"|"check"|"users"|"dice"|"plus";
const icons:Record<Mark,React.ReactNode> = {
 clock:<><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
 link:<><path d="m9 15 6-6m-5-2 2-2a5 5 0 0 1 7 7l-3 3m-2 2-2 2a5 5 0 0 1-7-7l3-3"/></>,
 rotate:<><path d="M4 10a8 8 0 0 1 14-4l2 3M20 4v5h-5m5 5a8 8 0 0 1-14 4l-2-3m0 5v-5h5"/></>,
 settings:<><path d="M4 7h8m5 0h3M4 17h3m5 0h8"/><circle cx="14.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/></>,
 flag:<><path d="M5 21V4c5-4 9 4 15 0v10c-6 4-10-4-15 0"/></>,
 copy:<><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H4v13h4"/></>,
 check:<path d="m4 12 5 5 11-11"/>,
 users:<><circle cx="10" cy="7" r="3"/><path d="M4 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 5m2 4a5 5 0 0 1 2 4"/></>,
 dice:<><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7.8 7.8h.4m7.6 0h.4m-4.4 4.2h.4m-4.4 4.2h.4m7.6 0h.4" strokeWidth="2.8"/></>,
 plus:<path d="M12 4v16M4 12h16"/>
};
function Icon({name,size=18}:{name:Mark,size?:number}) {return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>}
function Piece({code}:{code:string}) {return <svg className="piece" viewBox="0 0 40 40" aria-hidden="true"><use href={"./pieces.svg#"+code}/></svg>}
const presets=[[1,0],[3,0],[3,2],[5,0],[10,0],[15,10]];
const titleSide=(s:string)=>s==="w"?"Белые":"Чёрные";
const names:Record<string,string>={k:"король",q:"ферзь",b:"слон",r:"ладья",p:"пешка",n:"конь"};
const timeText=(ms:number)=>{const s=Math.ceil(Math.max(0,ms)/1000);return Math.floor(s/60).toString().padStart(2,"0")+":"+String(s%60).padStart(2,"0")};
function deviceKey(){
 let key=localStorage.getItem("gambit-seat");
 if(!key){const b=crypto.getRandomValues(new Uint8Array(16));const h=Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");key=[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join("-");localStorage.setItem("gambit-seat",key)}
 return key;
}
async function request(id:string|null,data?:object):Promise<Game>{
 const res=await fetch("https://gambit-doska-k8m4.zanyarch16.chatgpt.site/api/game"+(id?"?id="+encodeURIComponent(id):""),{method:data?"POST":"GET",cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+deviceKey()},body:data?JSON.stringify(data):undefined});
 const item=await res.json(); if(!res.ok) throw Error(item.error || "Не удалось получить партию.");return item;
}
export default function Page(){
 const [base,setBase]=useState(5),[inc,setInc]=useState(0),[custom,setCustom]=useState(false),[color,setColor]=useState("random");
 const [room,setRoom]=useState<string|null>(null),[g,setGame]=useState<Game|null>(null),[ready,setReady]=useState(false);
 const [flip,setFlip]=useState(false),[sel,select]=useState<Square|null>(null),[promotion,promote]=useState<Square|null>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false),[confirm,setConfirm]=useState(false);
 const [tick,setTick]=useState(0),timeAnchor=useRef(0),version=useRef(-1),sequence=useRef(0),accepted=useRef(0);
 function accept(item:Game,seq:number){if(item.version<version.current || (item.version===version.current && seq<accepted.current))return;accepted.current=seq;version.current=item.version;timeAnchor.current=Date.now();setTick(timeAnchor.current);setGame(item)}
 useEffect(()=>{setRoom(new URLSearchParams(location.search).get("game"));setReady(true)},[]);
 useEffect(()=>{if(!room)return;let alive=true;let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{const seq=++sequence.current;try{const item=await request(room);if(alive){accept(item,seq);setError(e=>e.startsWith("Нет связи")?"":e)}}catch(e){if(alive)setError("Нет связи с партией. "+(e as Error).message)}finally{if(alive)timer=setTimeout(poll,1200)}};
  poll();return()=>{alive=false;clearTimeout(timer)}},[room]);
 useEffect(()=>{if(!g?.started || g.result)return;const t=setInterval(()=>setTick(Date.now()),180);return()=>clearInterval(t)},[g?.started,g?.result]);
 useEffect(()=>{select(null);promote(null)},[g?.version]);
 useEffect(()=>{if(!copied)return;const t=setTimeout(()=>setCopied(false),2200);return()=>clearTimeout(t)},[copied]);
 const board=useMemo(()=>new Chess(g?.fen),[g?.fen]);
 const side=g?.side || (g? "w":color==="b"?"b":"w");
 const reversed=(side==="b")!==flip, files=(reversed?"hgfedcba":"abcdefgh").split(""),ranks=reversed?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];
 const moves=sel?board.moves({square:sel,verbose:true}):[];
 const canMove=!!g?.side && g.started && !g.result && g.turn===g.side && !busy;
 const link=room && ready ? location.origin+location.pathname+"?game="+encodeURIComponent(room):"";
 async function act(data:Record<string,unknown>){if(busy)return;setBusy(true);setError("");const seq=++sequence.current;
  try{const item=await request(room,{...data,version:version.current});if(data.action==="create"){history.replaceState(null,"","?game="+item.id);setRoom(item.id);setFlip(false)}accept(item,seq);select(null);promote(null);setConfirm(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function squareClick(sq:Square){if(!canMove || promotion)return;const valid=moves.find(m=>m.to===sq);if(valid){if(valid.isPromotion())promote(sq);else act({action:"move",from:sel,to:sq});return}select(sel!==sq&&board.get(sq)?.color===g?.side?sq:null)}
 async function copy(){try{await navigator.clipboard.writeText(link);setCopied(true)}catch{const el=document.querySelector<HTMLInputElement>("#invite");el?.focus();el?.select();setError("Скопируйте выделенную ссылку.")}}
 function participant(c:Color){const active=g?.started&&!g.result&&g.turn===c;const elapsed=active?Math.max(0,tick-timeAnchor.current):0;
 return <div className={"player "+(active?"active":"")}><span className={"avatar "+(c==="w"?"white":"black")}><Piece code={c+"k"}/></span><strong>{titleSide(c)}</strong>{g?.side===c&&<small>Вы</small>}<span className="clock"><Icon name="clock" size={16}/>{timeText(g?g.time[c]-elapsed:base*60000)}</span></div>}
 const status=g?.result || (g?.started?(g.side?(canMove?"Ваш ход":"Ход соперника"):"Наблюдение")+(board.isCheck()?" · шах":""):g?(g.side?"Ожидаем соперника":"Вас пригласили сыграть"):"Начальная позиция");
 const last=g?.log.at(-1), top:Color=reversed?"w":"b";
 return <><header><div className="bar"><a className="brand" href="./"><img src="./favicon.svg" alt="" width="38" height="38"/>Гамбит</a><span className="brand-rule"/><span className="brand-sub">Шахматный клуб</span><span className="header-note"><Icon name="users"/> Игра с другом</span></div></header>
 <main><div className="intro"><h1>{room?"Шахматная партия":"Шахматы по ссылке"}</h1><p>{room?"Доска, часы и запись ходов вашей партии.":"Выберите время и цвет фигур, затем отправьте сопернику приглашение."}</p></div>
 <div className="layout"><section className="board-panel"><div className="board-head"><h2>Доска</h2><button className="rotate" aria-label="Перевернуть доску" title="Перевернуть доску" onClick={()=>setFlip(!flip)}><Icon name="rotate" size={17}/></button></div>
 {participant(top)}<div className="board" aria-label="Шахматная доска">{ranks.map((rank,ri)=>files.map((f,fi)=>{const sq=(f+rank) as Square,p=board.get(sq),dark=(f.charCodeAt(0)-97+rank)%2===1,legal=moves.some(m=>m.to===sq);
 return <button key={sq} type="button" className={["sq",dark?"dark":"light",sel===sq?"selected":"",last&&(last.from===sq||last.to===sq)?"last":"",legal?"legal":""].join(" ")} tabIndex={g?.started?0:-1} aria-label={[sq,p?titleSide(p.color)+" "+names[p.type]:"пусто"].join(", ")} onClick={()=>squareClick(sq)}>{fi===0&&<i className="rank">{rank}</i>}{ri===7&&<i className="file">{f}</i>}{p&&<Piece code={p.color+p.type}/>}</button>}))}</div>{participant(top==="w"?"b":"w")}
 </section><aside><section className="card"><div className="panel-title"><span className="panel-icon"><Icon name={room?"flag":"settings"} size={22}/></span><h2>{room?"Ваша партия":"Новый вызов"}</h2></div>
 {!room?<><fieldset><legend><Icon name="clock"/>Контроль времени</legend><div className="presets">{presets.map(([m,s])=><button key={m+"-"+s} aria-pressed={!custom&&base===m&&inc===s} className={!custom&&base===m&&inc===s?"chosen":""} onClick={()=>{setBase(m);setInc(s);setCustom(false)}}><b>{m} + {s}</b><small>{m===1?"Пуля":m<=5?"Блиц":"Рапид"}</small></button>)}</div><button className="textbtn" onClick={()=>setCustom(!custom)} aria-expanded={custom}><Icon name="settings" size={15}/>Своё время</button>{custom&&<div className="custom"><label>Минуты<input type="number" min="1" max="180" value={base||""} onChange={e=>setBase(+e.target.value)}/></label><label>Добавка, сек<input type="number" min="0" max="60" value={inc} onChange={e=>setInc(+e.target.value)}/></label></div>}</fieldset>
 <fieldset className="color-set"><legend>Ваш цвет</legend><div className="colors">{[["w","Белые"],["random","Случайный"],["b","Чёрные"]].map(([v,label])=><button key={v} className={color===v?"chosen":""} aria-pressed={color===v} onClick={()=>setColor(v)}>{v==="random"?<Icon name="dice" size={25}/>:<Piece code={v+"k"}/>}<span>{label}</span></button>)}</div></fieldset><button className="primary" disabled={!ready||busy||base<1||base>180||inc<0||inc>60} onClick={()=>act({action:"create",base,inc,color})}><Icon name="link"/>{busy?"Создаём…":"Создать ссылку"}</button><p className="hint">Часы запустятся, когда соперник примет вызов.</p></>:
 !g?<p>Загружаем партию…</p>:<><h3 className="state" aria-live="polite">{status}</h3><div className="facts"><div>Контроль времени <b>{g.base} + {g.inc}</b></div><div>{g.side?"Ваш цвет":"Цвет приглашённого"} <b>{titleSide(g.side || (g.host==="w"?"b":"w"))}</b></div></div>
 {!g.started&&(g.side?<><label className="invite-label" htmlFor="invite">Приглашение для соперника</label><input id="invite" value={link} readOnly onFocus={e=>e.target.select()}/><button className="primary" onClick={copy}><Icon name={copied?"check":"copy"}/>{copied?"Скопировано":"Скопировать ссылку"}</button></>:<button className="primary" disabled={busy} onClick={()=>act({action:"join"})}><Icon name="flag"/>Принять вызов</button>)}
 {g.started&&!g.result&&g.side&&(!confirm?<button className="secondary" onClick={()=>setConfirm(true)}>Сдаться</button>:<div className="resign"><p>Завершить партию поражением?</p><button className="secondary" disabled={busy} onClick={()=>act({action:"resign"})}>Да, сдаться</button><button className="textbtn" onClick={()=>setConfirm(false)}>Продолжить игру</button></div>)}
 {g.result&&<a href="./" className="primary"><Icon name="plus"/>Новая партия</a>}</>}
 {error&&<p role="alert" className="error">{error}</p>}{room&&!g&&error&&<a className="textbtn" href="./">Новый вызов</a>}</section>
 {g?.started&&<section className="card history"><h2>Ходы партии</h2>{g.log.length?<ol>{g.log.filter((_,i)=>i%2===0).map((m,i)=><li key={i}><span>{i+1}.</span><b>{m.san}</b><b>{g.log[2*i+1]?.san}</b></li>)}</ol>:<p>Белые делают первый ход.</p>}</section>}
 </aside></div></main>{promotion&&<div className="overlay"><div className="card" role="dialog" aria-modal="true" aria-label="Превращение пешки"><h2>Превращение пешки</h2><p>Выберите фигуру</p><div className="promotions">{["q","r","b","n"].map(p=><button key={p} disabled={busy} aria-label={names[p]} onClick={()=>act({action:"move",from:sel,to:promotion,promotion:p})}><Piece code={side+p}/></button>)}</div><button className="textbtn" onClick={()=>promote(null)}>Отмена</button></div></div>}</>
}