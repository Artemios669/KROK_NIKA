"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowRight,AlertCircle} from "lucide-react";
import {animals as demoAnimals} from "@/lib/demo-data";
import {recommendations} from "@/lib/matching";
import {readTraitSwipes,SwipeReaction} from "@/lib/characteristics";
import {emptyProfile,UserProfile} from "@/types/user";
import {Animal} from "@/types/animal";
import {userProfileSchema} from "@/lib/validation/profile";

export default function Results(){
  const [profile,setProfile]=useState<UserProfile>(emptyProfile);
  const [swipes,setSwipes]=useState<SwipeReaction[]>([]);
  const [animals,setAnimals]=useState<Animal[]>(demoAnimals);
  const [source,setSource]=useState<"demo"|"supabase">("demo");
  const [error,setError]=useState("");
  useEffect(()=>{
    try{
      const saved=localStorage.getItem("niker-profile");
      if(saved)setProfile(userProfileSchema.parse(JSON.parse(saved)));
    }catch{
      setError("Не удалось прочитать сохранённый профиль; показаны общие рекомендации.");
    }
    setSwipes(readTraitSwipes());
    fetch("/api/animals").then(async response=>{
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data.animals))throw new Error("Список животных отсутствует.");
      setAnimals(data.animals);
      setSource(data.source==="supabase"?"supabase":"demo");
    }).catch(()=>{
      setError("Не удалось обновить список приюта; показаны тестовые данные.");
    });
  },[]);
  const list=useMemo(()=>recommendations(animals,profile,swipes),[animals,profile,swipes]);
  const top=list[0];
  if(!top)return <main className="empty"><h1>Подтверждённых вариантов пока нет</h1><p>Попробуйте уточнить условия или обратитесь к команде приюта.</p><Link className="button" href="/chat">Вернуться к диалогу</Link></main>;
  const animal=top.animal;
  return <main className="results">
    <span className="eyebrow">{source==="supabase"?"ДАННЫЕ ПРИЮТА":"ТЕСТОВЫЕ ДАННЫЕ"} · Ориентировочная рекомендация</span>
    <h1>Кажется, мы нашли пару!</h1>
    <p className="notice">Это оценка алгоритма, а не гарантия успешного пристройства. Реакции на характеристики учтены в сортировке.</p>
    {error&&<p className="notice" role="status">{error}</p>}
    <section className="best"><img src={animal.image_url} alt={animal.name}/><div>
      <div className="score">{top.score}%</div><h2>{animal.name}, {animal.age_years} г.</h2><p>{animal.description}</p>
      <h3>Почему может подойти</h3><ul>{(top.matches.length?top.matches:["Базовые предпочтения пока заполнены не полностью"]).map(item=><li key={item}>{item}</li>)}</ul>
      {[...top.risks,...top.questions].length>0&&<p className="risk"><AlertCircle/> {[...top.risks,...top.questions].join(" ")}</p>}
      <div className="actions"><Link className="button" href={`/animals/${animal.id}`}>Подробнее <ArrowRight/></Link><Link className="button ghost" href={`/adoption?animal=${animal.id}`}>Хочу познакомиться</Link></div>
    </div></section>
    <h2>Ещё можно посмотреть</h2>
    <div className="grid">{list.slice(1,5).map(match=><Link className="mini" href={`/animals/${match.animal.id}`} key={match.animal.id}><img src={match.animal.image_url} alt=""/><b>{match.animal.name}</b><span>{match.score}% совпадение</span></Link>)}</div>
  </main>;
}
