"use client";
import {PointerEvent,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Heart,RotateCcw,X} from "lucide-react";
import {animals as demoAnimals} from "@/lib/demo-data";
import {buildCharacteristicCards,MAX_CHARACTERISTIC_CARDS,readTraitSwipes,SwipeReaction} from "@/lib/characteristics";
import {Animal} from "@/types/animal";

export function CharacteristicSwipe({onBack,onShowResults}:{onBack?:()=>void;onShowResults?:()=>void}){
  const [animals,setAnimals]=useState<Animal[]>([]);
  const [source,setSource]=useState<"demo"|"supabase"|"mixed">("demo");
  const [catalogStats,setCatalogStats]=useState<{total:number;eligible:number;unavailable:number;unsupportedType:number;unconfirmedAvailability:number}|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [swipes,setSwipes]=useState<SwipeReaction[]>([]);
  const [index,setIndex]=useState(0);
  const [dragX,setDragX]=useState(0);
  const [failedImageId,setFailedImageId]=useState<string|null>(null);
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
      setSource(data.source==="supabase"||data.source==="mixed"?data.source:"demo");
      if(Number.isInteger(data.totalRecords)&&Number.isInteger(data.eligibleRecords)) {
        setCatalogStats({
          total:data.totalRecords,
          eligible:data.eligibleRecords,
          unavailable:Number.isInteger(data.unavailableRecords)?data.unavailableRecords:0,
          unsupportedType:Number.isInteger(data.unsupportedTypeRecords)?data.unsupportedTypeRecords:0,
          unconfirmedAvailability:Number.isInteger(data.unconfirmedAvailabilityRecords)?data.unconfirmedAvailabilityRecords:0,
        });
      }
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
      <span className="eyebrow">{source==="demo"?"ТЕСТОВЫЕ ДАННЫЕ":source==="mixed"?"В БАЗЕ ЕСТЬ ТЕСТОВЫЕ КАРТОЧКИ":"КАТАЛОГ ИЗ БАЗЫ"} · ДО {MAX_CHARACTERISTIC_CARDS} КАРТОЧЕК</span>
      <h1>Выбирайте характеристики</h1>
      <p>Свайпайте особенности питомцев, а не их фотографии или имена. Неизвестные сведения не придумываем.</p>
      {catalogStats&&<p className="trait-catalog-count">
        Для карточек загружено {catalogStats.eligible} животных из {catalogStats.total} записей.
        {catalogStats.unavailable>0&&` Недоступны для пристройства: ${catalogStats.unavailable}.`}
        {catalogStats.unsupportedType>0&&` Тип не распознан: ${catalogStats.unsupportedType}.`}
        {catalogStats.unconfirmedAvailability>0&&` Статус доступности не указан; по правилу каталога эти записи учитываются как доступные: ${catalogStats.unconfirmedAvailability}.`}
      </p>}
    </div>
    {error&&<p className="trait-error" role="status">{error}</p>}
    {loading?<div className="trait-loading">Подготавливаем карточки…</div>:!current?<div className="trait-finished">
      {cards.length===0
        ?<><h2>Пока нет заполненных характеристик</h2><p>Когда приют добавит сведения, их можно будет оценить здесь.</p><button className="trait-reset" onClick={restart}><RotateCcw size={16}/> Обновить карточки</button></>
        :<>
          <span className="eyebrow">ЭТО ВСЁ НА СЕГОДНЯ</span>
          <h2>Вы оценили все карточки</h2>
          <p>Все {cards.length} характеристик получили вашу реакцию. Чтобы пройти карточки заново, нажмите «Свайпать снова» — сохранённые реакции будут заменены.</p>
          <button className="button" onClick={restart}><RotateCcw size={16}/> Свайпать снова</button>
          {onShowResults
            ?<button className="trait-reset" type="button" onClick={onShowResults}>Посмотреть подбор <ArrowRight size={17}/></button>
            :<Link className="trait-reset" href="/results">Посмотреть подбор <ArrowRight size={17}/></Link>}
        </>}
    </div>:<>
      <div className="trait-count">Карточка {index+1} из {cards.length}</div>
      <div className="trait-progress"><span style={{width:`${index/cards.length*100}%`}}/></div>
      <div className="trait-card-wrap">
        <div className={`trait-card ${dragX>30?"is-like":dragX< -30?"is-skip":""}`}
          style={{transform:`translateX(${dragX}px) rotate(${dragX/18}deg)`}}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
          onPointerCancel={()=>{startX.current=null;setDragX(0)}} role="group" aria-label={current.text}>
          <div className="trait-photo">
            {current.imageUrl&&failedImageId!==current.id
              ?<img
                src={current.imageUrl}
                alt={`Иллюстрация к характеристике: ${current.text}`}
                draggable={false}
                onError={()=>setFailedImageId(current.id)}
              />
              :<div className="trait-photo-placeholder" role="img" aria-label="Фото питомца не добавлено или недоступно">
                Фото питомца не добавлено или недоступно
              </div>}
          </div>
          <div className="trait-card-copy">
            <span className="trait-kicker">ХАРАКТЕРИСТИКА · {current.title.toLocaleUpperCase("ru")}</span>
            <p>{current.text}</p>
            <span className="trait-hint">Потяните вправо или влево</span>
          </div>
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
