"use client";
import {useState} from "react";
import {Send} from "lucide-react";
import {emptyProfile,UserProfile} from "@/types/user";
import {CharacteristicSwipe} from "@/components/characteristic-swipe";

type Msg={role:"assistant"|"user";text:string};
const initial:Msg={role:"assistant",text:"Здравствуйте! Я виртуальный помощник НИКИ. Расскажите, пожалуйста, где вы живёте и как обычно проходит ваш день?"};
const swipeInviteAfter=6;

export default function Chat(){
  const [msgs,setMsgs]=useState<Msg[]>([initial]);
  const [value,setValue]=useState("");
  const [profile,setProfile]=useState<UserProfile>(emptyProfile);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [mode,setMode]=useState<"demo"|"gemini">("demo");
  const [assistantTurns,setAssistantTurns]=useState(0);
  const [stage,setStage]=useState<"chat"|"swipes">("chat");

  async function send(){
    if(!value.trim()||loading)return;
    const text=value.trim();
    setMsgs(messages=>[...messages,{role:"user",text}]);
    setValue("");
    setError("");
    setLoading(true);
    try{
      const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,profile,history:msgs.slice(-10)})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      setProfile(data.profile);
      setMode(data.mode);
      setAssistantTurns(turns=>turns+1);
      setMsgs(messages=>[...messages,{role:"assistant",text:data.message}]);
      if(data.profile.completed)localStorage.setItem("niker-profile",JSON.stringify(data.profile));
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Не удалось отправить сообщение.");
    }finally{
      setLoading(false);
    }
  }

  if(stage==="swipes")return <main className="trait-page"><CharacteristicSwipe onBack={()=>setStage("chat")}/></main>;

  return <main className="chat-wrap">
    <aside>
      <span className="demo">{mode==="gemini"?"GEMINI-ПОМОЩНИК":"ДЕМОНСТРАЦИОННЫЙ РЕЖИМ"}</span>
      <h2>Узнаём друг друга</h2>
      <p>Ответьте в свободной форме. Можно пропустить любой вопрос.</p>
      <div className="progress"><span style={{width:`${Math.min(100,assistantTurns/swipeInviteAfter*100)}%`}}/></div>
      <small>Вопросов от помощника: {Math.min(assistantTurns,swipeInviteAfter)} из {swipeInviteAfter}. Ваш профиль не отправляется реальному приюту.</small>
    </aside>
    <section className="chat">
      <div className="messages">{msgs.map((message,index)=><p key={index} className={message.role}>{message.text}</p>)}{loading&&<p className="assistant">Подбираю следующий вопрос…</p>}{error&&<p className="error" role="alert">{error}</p>}</div>
      {assistantTurns>=swipeInviteAfter&&<div className="swipe-invite"><h3>Уже можно переходить к предпочтениям</h3><p>Попробуйте свайпать характеристики питомцев — имена и фотографии показывать не будем.</p><button className="button wide" onClick={()=>setStage("swipes")}>Посвайпать характеристики</button></div>}
      <div className="composer"><input value={value} onChange={event=>setValue(event.target.value)} onKeyDown={event=>event.key==="Enter"&&send()} placeholder="Напишите ответ…" maxLength={800}/><button onClick={send} aria-label="Отправить" disabled={loading}><Send/></button></div>
    </section>
  </main>;
}
