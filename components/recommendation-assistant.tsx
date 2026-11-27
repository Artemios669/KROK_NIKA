"use client";

import {FormEvent,useEffect,useRef,useState} from "react";
import {MessageCircle,Send,X} from "lucide-react";
import type {SwipeReaction} from "@/lib/characteristics";
import type {UserProfile} from "@/types/user";

type Message={role:"assistant"|"user";text:string};

type Props={
  animalId:string;
  animalName:string;
  score:number|null;
  profile:UserProfile;
  swipes:SwipeReaction[];
};

const suggestions=[
  "Почему такой процент совместимости?",
  "Что стоит уточнить у приюта?",
  "Какие особенности питомца подходят моей семье?",
];

export function RecommendationAssistant({animalId,animalName,score,profile,swipes}:Props) {
  const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState<Message[]>([{
    role:"assistant",
    text:"Могу объяснить процент и выводы по карточке. Если сведений не хватает, скажу об этом и подскажу, что уточнить у приюта.",
  }]);
  const [value,setValue]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const dialogRef=useRef<HTMLDialogElement>(null);
  const messagesEndRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    if(open&&!dialog.open)dialog.showModal();
    else if(!open&&dialog.open)dialog.close();
  },[open]);

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:"smooth",block:"end"});
  },[messages,loading]);

  async function sendMessage(text:string) {
    const outgoing=text.trim();
    if(!outgoing||loading)return;
    const history=messages.slice(1).slice(-10);
    setValue("");
    setError("");
    setLoading(true);

    try {
      const response=await fetch("/api/recommendation-assistant",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          message:outgoing,
          animalId,
          profile,
          swipes,
          history,
        }),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(typeof result.error==="string"?result.error:"Не удалось получить ответ ассистента.");
      if(typeof result.message!=="string")throw new Error("Ассистент вернул ответ в неверном формате.");
      setMessages(items=>[...items,{role:"user",text:outgoing},{role:"assistant",text:result.message}]);
    } catch(cause) {
      setValue(outgoing);
      setError(cause instanceof Error?cause.message:"Не удалось связаться с ассистентом.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(value);
  }

  return <>
    <button className="button ghost recommendation-assistant-launch" type="button" onClick={()=>setOpen(true)}>
      <MessageCircle aria-hidden="true" size={17}/>
      Узнать у ассистента больше
    </button>
    <dialog
      ref={dialogRef}
      className="recommendation-assistant-dialog"
      aria-labelledby="recommendation-assistant-title"
      onClose={()=>setOpen(false)}
      onClick={event=>{if(event.target===event.currentTarget)setOpen(false)}}
    >
      <section className="recommendation-assistant-shell">
        <header className="recommendation-assistant-header">
          <div>
            <h2 id="recommendation-assistant-title">Вопрос о питомце: {animalName}</h2>
            <p>{score===null
              ?"Процент не рассчитан: недостаточно известных данных."
              :`Оценка алгоритма — ${score}%, это не вероятность успешного пристройства.`}</p>
          </div>
          <button className="recommendation-assistant-close" type="button" onClick={()=>setOpen(false)} aria-label="Закрыть чат">
            <X aria-hidden="true" size={20}/>
          </button>
        </header>
        <div className="recommendation-assistant-messages" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message,index)=><article className={`recommendation-assistant-message ${message.role}`} key={`${index}-${message.role}`}>
            <span>{message.role==="assistant"?"НИКА":"Вы"}</span>
            <p>{message.text}</p>
          </article>)}
          {loading&&<p className="recommendation-assistant-loading" role="status">Ассистент готовит ответ…</p>}
          {error&&<p className="recommendation-assistant-error" role="alert">{error}</p>}
          <div ref={messagesEndRef}/>
        </div>
        {messages.length===1&&<div className="recommendation-assistant-suggestions" aria-label="Примеры вопросов">
          {suggestions.map(suggestion=><button
            type="button"
            key={suggestion}
            onClick={()=>void sendMessage(suggestion)}
            disabled={loading}
          >{suggestion}</button>)}
        </div>}
        <form className="recommendation-assistant-composer" onSubmit={submit}>
          <textarea
            value={value}
            onChange={event=>setValue(event.target.value)}
            onKeyDown={event=>{
              if(event.key==="Enter"&&!event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Напишите вопрос…"
            aria-label="Сообщение ассистенту"
            maxLength={800}
            rows={2}
            disabled={loading}
          />
          <button className="button" type="submit" aria-label="Отправить сообщение" disabled={loading||!value.trim()}>
            <Send aria-hidden="true" size={17}/>
          </button>
        </form>
      </section>
    </dialog>
  </>;
}
