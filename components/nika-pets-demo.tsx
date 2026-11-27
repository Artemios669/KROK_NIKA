"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Heart,
  ImageOff,
  Maximize2,
  MessageCircle,
  Minimize2,
  PawPrint,
  Search,
  X,
} from "lucide-react";
import {ChatExperience} from "@/components/chat-experience";
import {SiteHeader} from "@/components/site-header";
import {animalTypeLabel,formatAnimalAge} from "@/lib/animal-catalog";
import {animalsSchema} from "@/lib/validation/animal";
import type {Animal} from "@/types/animal";

type AnimalFilter="all"|"dog"|"cat";
type CatalogState="loading"|"ready"|"error";

function isRecord(value:unknown):value is Record<string,unknown> {
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}

function responseError(payload:unknown) {
  if(isRecord(payload)&&typeof payload.error==="string")return payload.error;
  return "Не удалось загрузить каталог животных.";
}

function AnimalCard({animal}:{animal:Animal}) {
  const [imageFailed,setImageFailed]=useState(false);

  return <article className="nika-pet-card">
    <Link className="nika-pet-image" href={`/animals/${encodeURIComponent(animal.id)}`} aria-label={`Подробнее о животном: ${animal.name}`}>
      {animal.image_url&&!imageFailed
        ?<img src={animal.image_url} alt={animal.name} loading="lazy" onError={()=>setImageFailed(true)}/>
        :<span className="nika-pet-image-fallback"><ImageOff size={28}/><span>Фото пока нет</span></span>}
      <span className="nika-pet-type">{animalTypeLabel(animal.type)}</span>
    </Link>
    <div className="nika-pet-card-copy">
      <div className="nika-pet-title-row">
        <h2>{animal.name}</h2>
        <Heart size={18} aria-hidden="true"/>
      </div>
      <p className="nika-pet-age">{formatAnimalAge(animal)}</p>
      <p className="nika-pet-description">{animal.description||"История этого животного скоро появится."}</p>
      <Link className="nika-pet-more" href={`/animals/${encodeURIComponent(animal.id)}`}>
        Подробнее <ArrowUpRight size={15}/>
      </Link>
    </div>
  </article>;
}

export function NikaPetsDemo() {
  const [animals,setAnimals]=useState<Animal[]>([]);
  const [catalogState,setCatalogState]=useState<CatalogState>("loading");
  const [error,setError]=useState("");
  const [filter,setFilter]=useState<AnimalFilter>("all");
  const [query,setQuery]=useState("");
  const [visibleCount,setVisibleCount]=useState(12);
  const [chatOpen,setChatOpen]=useState(true);
  const [chatMounted,setChatMounted]=useState(true);
  const [chatExpanded,setChatExpanded]=useState(false);
  const [isMobile,setIsMobile]=useState(false);
  const [reloadCount,setReloadCount]=useState(0);

  useEffect(()=>{
    const mediaQuery=window.matchMedia("(max-width: 900px)");
    const updateIsMobile=()=>setIsMobile(mediaQuery.matches);
    updateIsMobile();
    mediaQuery.addEventListener("change",updateIsMobile);
    return ()=>mediaQuery.removeEventListener("change",updateIsMobile);
  },[]);

  useEffect(()=>{
    let active=true;

    async function loadAnimals() {
      setCatalogState("loading");
      setError("");

      try {
        const response=await fetch("/api/animals");
        const payload:unknown=await response.json();
        if(!response.ok)throw new Error(responseError(payload));
        if(!isRecord(payload)||!Array.isArray(payload.animals)) {
          throw new Error("Сервер вернул каталог в неверном формате.");
        }
        const parsedAnimals=animalsSchema.safeParse(payload.animals);
        if(!parsedAnimals.success)throw new Error("В каталоге есть записи с неверным форматом.");
        if(active) {
          setAnimals(parsedAnimals.data);
          setCatalogState("ready");
        }
      } catch(cause) {
        if(active) {
          setError(cause instanceof Error?cause.message:"Не удалось загрузить каталог животных.");
          setCatalogState("error");
        }
      }
    }

    void loadAnimals();
    return ()=>{active=false};
  },[reloadCount]);

  useEffect(()=>{
    if(!chatOpen)return;
    const previousOverflow=document.body.style.overflow;
    if(isMobile)document.body.style.overflow="hidden";
    const closeOnEscape=(event:KeyboardEvent)=>{
      if(event.key==="Escape") {
        setChatOpen(false);
        setChatExpanded(false);
      }
    };
    window.addEventListener("keydown",closeOnEscape);
    return ()=>{
      if(isMobile)document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",closeOnEscape);
    };
  },[chatOpen,isMobile]);

  const filteredAnimals=useMemo(()=>{
    const normalizedQuery=query.trim().toLocaleLowerCase("ru");
    return animals.filter(animal=>
      (filter==="all"||animal.type===filter)&&
      (!normalizedQuery||animal.name.toLocaleLowerCase("ru").includes(normalizedQuery)),
    );
  },[animals,filter,query]);
  const visibleAnimals=filteredAnimals.slice(0,visibleCount);

  function openChat() {
    setChatMounted(true);
    setChatOpen(true);
  }

  function closeChat() {
    setChatOpen(false);
    setChatExpanded(false);
  }

  return <div className={`nika-pets-page${chatOpen?" has-chat-open":""}`}>
    <header className="nika-demo-header" inert={chatOpen&&isMobile}>
      <Link className="nika-demo-brand" href="/ourpets" aria-label="Фонд НИКА — подопечные">
        <span className="nika-demo-brand-mark"><PawPrint size={22}/></span>
        <span><strong>Фонд НИКА</strong><small>Помогаем найти дом</small></span>
      </Link>
      <nav className="nika-demo-nav" aria-label="Разделы сайта">
        <button
          className="nika-demo-tab is-active"
          type="button"
          aria-label="Подопечные — открыть помощника"
          aria-controls={chatMounted?"nika-chat-drawer":undefined}
          aria-expanded={chatOpen}
          onClick={openChat}
        >
          <MessageCircle size={16} aria-hidden="true"/>
          Подопечные
        </button>
      </nav>
      <a className="nika-demo-external" href="https://fond-nika.ru/ourpets" target="_blank" rel="noreferrer">
        Официальный сайт <ArrowUpRight size={15}/>
      </a>
    </header>

    <main className="nika-pets-main" inert={chatOpen&&isMobile}>
      <section className="nika-pets-intro">
        <div>
          <span className="nika-pets-eyebrow">Дом начинается со знакомства</span>
          <h1>Наши подопечные</h1>
          <p>Каждый из них ждёт человека, с которым совпадут характер и образ жизни.</p>
        </div>
        <div className="nika-pets-count" aria-live="polite">
          <PawPrint size={18}/>
          <span>{catalogState==="ready"?`${filteredAnimals.length} животных`:"Каталог животных"}</span>
        </div>
      </section>

      <section className="nika-pets-controls" aria-label="Поиск и фильтры животных">
        <label className="nika-pets-search">
          <Search size={18} aria-hidden="true"/>
          <span className="visually-hidden">Поиск по имени</span>
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Найти по имени"/>
        </label>
        <div className="nika-pets-filters" role="group" aria-label="Тип животного">
          {([
            ["all","Все"],
            ["dog","Собаки"],
            ["cat","Кошки"],
          ] as const).map(([value,label])=><button
            className={filter===value?"is-selected":""}
            type="button"
            key={value}
            aria-pressed={filter===value}
            onClick={()=>setFilter(value)}
          >{label}</button>)}
        </div>
      </section>

      {catalogState==="loading"&&<div className="nika-pets-state" role="status">Загружаем подопечных…</div>}
      {catalogState==="error"&&<div className="nika-pets-state is-error" role="alert">
        <AlertCircle size={20}/>
        <span>{error}</span>
        <button type="button" onClick={()=>setReloadCount(count=>count+1)}>Повторить</button>
      </div>}
      {catalogState==="ready"&&filteredAnimals.length===0&&<div className="nika-pets-state">
        По вашему запросу животных не найдено.
      </div>}
      {catalogState==="ready"&&filteredAnimals.length>0&&<>
        <div className="nika-pets-grid">
          {visibleAnimals.map(animal=><AnimalCard animal={animal} key={animal.id}/>)}
        </div>
        {visibleCount<filteredAnimals.length&&<button
          className="nika-pets-load-more"
          type="button"
          onClick={()=>setVisibleCount(count=>count+12)}
        >
          Показать ещё
        </button>}
      </>}
    </main>

    {chatOpen&&isMobile&&<button
      className="nika-chat-backdrop"
      type="button"
      aria-label="Закрыть чат"
      aria-hidden="true"
      tabIndex={-1}
      onClick={closeChat}
    />}
    {chatMounted&&<section
      className={`nika-chat-drawer${chatOpen?" is-open":""}${chatExpanded?" is-expanded":""}`}
      id="nika-chat-drawer"
      role="dialog"
      aria-modal={chatOpen&&isMobile?"true":undefined}
      aria-labelledby="nika-chat-title"
      aria-hidden={!chatOpen}
      inert={!chatOpen}
    >
      <SiteHeader embedded/>
      <header className="nika-chat-header">
        <span className="nika-chat-avatar"><PawPrint size={19}/></span>
        <div className="nika-chat-heading">
          <strong id="nika-chat-title">Помощник НИКИ</strong>
          <span>Подберём питомца вместе</span>
        </div>
        <div className="nika-chat-actions">
          <button
            type="button"
            aria-label={chatExpanded?"Свернуть чат":"Развернуть чат на весь экран"}
            title={chatExpanded?"Свернуть":"На весь экран"}
            onClick={()=>setChatExpanded(expanded=>!expanded)}
          >
            {chatExpanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}
          </button>
          <button type="button" aria-label="Закрыть чат" title="Закрыть" onClick={closeChat}>
            <X size={20}/>
          </button>
        </div>
      </header>
      <div className="nika-chat-content">
        <ChatExperience/>
      </div>
    </section>}
    <button
      className={`nika-chat-launcher${chatOpen?" is-open":""}`}
      type="button"
      aria-label="Открыть чат с помощником НИКИ"
      aria-controls={chatMounted?"nika-chat-drawer":undefined}
      aria-expanded={chatOpen}
      onClick={openChat}
    >
      <MessageCircle size={18} aria-hidden="true"/>
      <span>Чат</span>
    </button>
  </div>;
}
