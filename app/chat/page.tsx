"use client";

import {useLayoutEffect,useRef,useState} from "react";
import {Send} from "lucide-react";
import {CharacteristicSwipe} from "@/components/characteristic-swipe";
import {useRoadmap} from "@/components/roadmap-context";
import {ChatTopic,getChatProgress,chatTopicSchema} from "@/lib/chat/progress";
import {getChatScenario} from "@/lib/chat/scenarios";
import {userProfileSchema} from "@/lib/validation/profile";
import {emptyProfile,UserProfile} from "@/types/user";

type Message={role:"assistant"|"user";text:string};
type FailedMessage={text:string;topic:ChatTopic;skip:boolean};

const requiredAnswersForSwipes=5;

const initial:Message={
  role:"assistant",
  text:`Здравствуйте! Я виртуальный помощник НИКИ. ${getChatScenario(emptyProfile,"housing").question}`,
};

export default function Chat() {
  const {setActiveStep}=useRoadmap();
  const [messages,setMessages]=useState<Message[]>([initial]);
  const [value,setValue]=useState("");
  const [profile,setProfile]=useState<UserProfile>(emptyProfile);
  const [skippedTopics,setSkippedTopics]=useState<ChatTopic[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [failedMessage,setFailedMessage]=useState<FailedMessage|null>(null);
  const [mode,setMode]=useState<"demo"|"gemini">("demo");
  const [stage,setStage]=useState<"chat"|"swipes">("chat");
  const [answeredQuestions,setAnsweredQuestions]=useState(0);
  const [swipeBannerTop,setSwipeBannerTop]=useState(12);
  const answersLabelRef=useRef<HTMLElement>(null);
  const chatRef=useRef<HTMLElement>(null);

  const progress=getChatProgress(profile,skippedTopics);
  const answeredRequiredQuestions=Math.min(answeredQuestions,requiredAnswersForSwipes);

  useLayoutEffect(()=>{
    setActiveStep(stage==="chat"?"chat":"swipes");
  },[stage,setActiveStep]);

  useLayoutEffect(()=>{
    if(answeredQuestions<requiredAnswersForSwipes||stage!=="chat")return;

    const updateBannerPosition=()=>{
      const answersLabel=answersLabelRef.current?.getBoundingClientRect();
      const chat=chatRef.current?.getBoundingClientRect();
      if(!answersLabel||!chat)return;
      setSwipeBannerTop(Math.max(12,answersLabel.bottom-chat.top+8));
    };

    const observer=new ResizeObserver(updateBannerPosition);
    if(answersLabelRef.current)observer.observe(answersLabelRef.current);
    if(chatRef.current)observer.observe(chatRef.current);
    window.addEventListener("resize",updateBannerPosition);
    updateBannerPosition();

    return ()=>{
      observer.disconnect();
      window.removeEventListener("resize",updateBannerPosition);
    };
  },[answeredQuestions,stage]);

  async function sendMessage(text:string,skip=false,retry?:FailedMessage) {
    if(loading||(!retry&&!text.trim()))return;
    const topic=retry?.topic||progress.nextTopic||"housing";
    const outgoing=text.trim();
    const history=retry&&messages.at(-1)?.role==="user"&&messages.at(-1)?.text===retry.text
      ?messages.slice(0,-1)
      :messages;

    if(!retry) {
      setMessages(items=>[...items,{role:"user",text:outgoing}]);
      setValue("");
    }
    setError("");
    setLoading(true);

    try {
      const response=await fetch("/api/chat",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          message:outgoing,
          profile,
          history:history.slice(-10),
          currentTopic:topic,
          skippedTopics,
          skipCurrentQuestion:skip,
        }),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Не удалось отправить сообщение.");

      const parsedProfile=userProfileSchema.safeParse(data.profile);
      if(!parsedProfile.success||typeof data.message!=="string") {
        throw new Error("Сервер вернул некорректный ответ. Попробуйте ещё раз.");
      }

      const parsedSkipped=chatTopicSchema.array().safeParse(data.progress?.skippedTopics);
      const nextSkipped=parsedSkipped.success?parsedSkipped.data:skippedTopics;
      setProfile(parsedProfile.data);
      setSkippedTopics(nextSkipped);
      setMode(data.mode==="gemini"?"gemini":"demo");
      setMessages(items=>[...items,{role:"assistant",text:data.message}]);
      setFailedMessage(null);
      if(!skip)setAnsweredQuestions(count=>count+1);

      try {
        localStorage.setItem("niker-profile",JSON.stringify(parsedProfile.data));
      } catch {
        setError("Профиль обновлён, но браузер не смог сохранить его для следующего этапа.");
      }
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"Не удалось отправить сообщение.");
      setFailedMessage({text:outgoing,topic,skip});
    } finally {
      setLoading(false);
    }
  }

  function send() {
    void sendMessage(value);
  }

  function skipQuestion() {
    void sendMessage("Пропустить вопрос",true);
  }

  function retryMessage() {
    if(failedMessage)void sendMessage(failedMessage.text,failedMessage.skip,failedMessage);
  }

  function removeFailedMessage() {
    if(failedMessage) {
      setMessages(items=>items.at(-1)?.role==="user"&&items.at(-1)?.text===failedMessage.text?items.slice(0,-1):items);
    }
    setFailedMessage(null);
    setError("");
  }

  if(stage==="swipes")return <main className="trait-page"><CharacteristicSwipe onBack={()=>setStage("chat")}/></main>;

  return <main className="chat-wrap">
    <aside>
      <span className="demo">{mode==="gemini"?"GEMINI-ПОМОЩНИК":"ДЕМОНСТРАЦИОННЫЙ РЕЖИМ"}</span>
      <h2>Узнаём друг друга</h2>
      <p>Я буду собирать связанные сведения вместе. Если не хотите отвечать на тему, её можно пропустить.</p>
      <div className="progress"><span style={{width:`${answeredRequiredQuestions/requiredAnswersForSwipes*100}%`}}/></div>
      <small ref={answersLabelRef}>Ответы на обязательные вопросы: {answeredRequiredQuestions} из {requiredAnswersForSwipes}.</small>
      <small>Профиль не отправляется реальному приюту.</small>
    </aside>
    <section className="chat" ref={chatRef}>
      {answeredQuestions>=requiredAnswersForSwipes&&<div className="chat-swipe-banner" role="status" style={{top:swipeBannerTop}}>
        <p>Вы ответили на пять обязательных вопросов. Можно перейти к свайпам или продолжить разговор.</p>
        <button className="button" type="button" onClick={()=>setStage("swipes")}>Свайпать характеристики</button>
      </div>}
      <div className="messages">
        {messages.map((message,index)=><p key={index} className={message.role}>{message.text}</p>)}
        {loading&&<p className="assistant">Подбираю следующий вопрос…</p>}
        {error&&<p className="error" role="alert">{error}</p>}
        {failedMessage&&<div className="chat-retry">
          <button type="button" onClick={retryMessage} disabled={loading}>Повторить отправку</button>
          <button type="button" onClick={removeFailedMessage} disabled={loading}>Убрать сообщение</button>
        </div>}
      </div>
      <div className="composer">
        <input
          value={value}
          onChange={event=>setValue(event.target.value)}
          onKeyDown={event=>event.key==="Enter"&&!event.shiftKey&&send()}
          placeholder="Напишите ответ…"
          maxLength={800}
          disabled={loading||Boolean(failedMessage)}
        />
        <button onClick={send} aria-label="Отправить" disabled={loading||!value.trim()||Boolean(failedMessage)}><Send/></button>
        {progress.nextTopic&&<button className="skip-question" type="button" onClick={skipQuestion} disabled={loading||Boolean(failedMessage)}>Пропустить</button>}
      </div>
    </section>
  </main>;
}
