"use client";
import {PointerEvent,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Heart,RotateCcw,X} from "lucide-react";
import {animals as demoAnimals} from "@/lib/demo-data";
import {buildCharacteristicCards,MAX_CHARACTERISTIC_CARDS,readTraitSwipes,SwipeReaction} from "@/lib/characteristics";
import {Animal} from "@/types/animal";

export function CharacteristicSwipe({onBack}:{onBack?:()=>void}){
  const [animals,setAnimals]=useState<Animal[]>([]);
  const [source,setSource]=useState<"demo"|"supabase">("demo");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [swipes,setSwipes]=useState<SwipeReaction[]>([]);
  const [index,setIndex]=useState(0);
  const [dragX,setDragX]=useState(0);
  const startX=useRef<number|null>(null);
  const cards=useMemo(()=>buildCharacteristicCards(animals),[animals]);
  const current=cards[index];

  useEffect(()=>{
    setSwipes(readTraitSwipes());
    fetch("/api/animals").then(async response=>{
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data.animals))throw new Error("Список карточек отсутствует.");
      setAnimals(data.animals);
      setSource(data.source==="supabase"?"supabase":"demo");
    }).catch(()=>{
      setAnimals(demoAnimals);
      setSource("demo");
      setError("Не удалось загрузить данные приюта; показаны тестовые характеристики.");
    }).finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    const savedIds=new Set(swipes.map(swipe=>swipe.cardId));
    const completed=cards.filter(card=>savedIds.has(card.id)).length;
    setIndex(completed);
  },[cards]);

  function react(reaction:"like"|"dislike"){
    if(!current)return;
    const swipe:SwipeReaction={cardId:current.id,field:current.field,value:current.value,reaction};
    const next=[...swipes.filter(item=>item.cardId!==swipe.cardId),swipe];
    setSwipes(next);
    setIndex(value=>value+1);
    setDragX(0);
    try{localStorage.setItem("niker-character-swipes",JSON.stringify(next))}
    catch{setError("Не удалось сохранить реакции на этом устройстве.")}
  }

  function pointerDown(event:PointerEvent<HTMLDivElement>){
    if(event.pointerType==="mouse"&&event.button!==0)return;
    startX.current=event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event:PointerEvent<HTMLDivElement>){
    if(startX.current!==null)setDragX(event.clientX-startX.current);
  }
  function pointerUp(event:PointerEvent<HTMLDivElement>){
    if(startX.current===null)return;
    const distance=event.clientX-startX.current;
    startX.current=null;
    if(Math.abs(distance)>90)react(distance>0?"like":"dislike");
    else setDragX(0);
  }

  function restart(){
    setSwipes([]);
    setIndex(0);
    setError("");
    try{localStorage.removeItem("niker-character-swipes")}
    catch{setError("Не удалось очистить сохранённые реакции.")}
  }

  return <section className="trait-swipe">
    <div className="trait-heading">
      {onBack&&<button className="trait-back" onClick={onBack}><ArrowLeft size={17}/> Вернуться к диалогу</button>}
      <span className="eyebrow">{source==="supabase"?"ПРОВЕРЕННЫЕ ДАННЫЕ ПРИЮТА":"ТЕСТОВЫЕ ДАННЫЕ"} · ДО {MAX_CHARACTERISTIC_CARDS} КАРТОЧЕК</span>
      <h1>Выбирайте характеристики</h1>
      <p>Свайпайте особенности питомцев, а не их фотографии или имена. Неизвестные сведения не придумываем.</p>
    </div>
    {error&&<p className="trait-error" role="status">{error}</p>}
    {loading?<div className="trait-loading">Подготавливаем карточки…</div>:!current?<div className="trait-finished">
      {cards.length===0?<><h2>Пока нет заполненных характеристик</h2><p>Когда приют добавит сведения, их можно будет оценить здесь.</p></>:<><span className="eyebrow">ЭТО ВСЁ НА СЕГОДНЯ</span><h2>Спасибо за ответы</h2><p>Мы учтём ваши реакции и покажем подходящие варианты.</p><Link className="button" href="/results">Посмотреть подбор <ArrowRight size={17}/></Link></>}
      <button className="trait-reset" onClick={restart}><RotateCcw size={16}/> Начать сначала</button>
    </div>:<>
      <div className="trait-count">Карточка {index+1} из {cards.length}</div>
      <div className="trait-progress"><span style={{width:`${index/cards.length*100}%`}}/></div>
      <div className="trait-card-wrap">
        <div className={`trait-card ${dragX>30?"is-like":dragX< -30?"is-skip":""}`}
          style={{transform:`translateX(${dragX}px) rotate(${dragX/18}deg)`}}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
          onPointerCancel={()=>{startX.current=null;setDragX(0)}} role="group" aria-label={current.text}>
          <span className="trait-kicker">ХАРАКТЕРИСТИКА · {current.title.toLocaleUpperCase("ru")}</span>
          <p>{current.text}</p>
          <span className="trait-hint">Потяните вправо или влево</span>
          {dragX>30&&<span className="trait-stamp like-stamp">НРАВИТСЯ</span>}
          {dragX< -30&&<span className="trait-stamp skip-stamp">НЕ МОЁ</span>}
        </div>
      </div>
      <div className="trait-controls">
        <button className="trait-no" onPointerDown={event=>event.stopPropagation()} onClick={()=>react("dislike")} aria-label="Не нравится"><X/></button>
        <button className="trait-yes" onPointerDown={event=>event.stopPropagation()} onClick={()=>react("like")} aria-label="Нравится"><Heart/></button>
      </div>
      <p className="trait-disclaimer">Истории и сведения о здоровье показываются только если они указаны приютом.</p>
    </>}
  </section>;
}
