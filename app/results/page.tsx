"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {AlertCircle,ArrowRight} from "lucide-react";
import {emptyProfile} from "@/types/user";
import {readTraitSwipes} from "@/lib/characteristics";
import {userProfileSchema} from "@/lib/validation/profile";
import {recommendationResponseSchema,RecommendationMatch} from "@/lib/validation/recommendations";
import {formatAnimalAge} from "@/lib/animal-catalog";

function responseError(value:unknown) {
  if(typeof value==="object"&&value!==null&&"error" in value&&typeof value.error==="string")return value.error;
  return "Не удалось рассчитать рекомендации.";
}

export default function Results(){
  const [matches,setMatches]=useState<RecommendationMatch[]>([]);
  const [source,setSource]=useState<"demo"|"supabase"|"mixed">("demo");
  const [catalogCounts,setCatalogCounts]=useState<{total:number;eligible:number;unavailable:number;unsupportedType:number;unconfirmedAvailability:number}|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let active=true;

    async function loadRecommendations() {
      let profile=emptyProfile;
      try {
        const savedProfile=localStorage.getItem("niker-profile");
        if(savedProfile) {
          const parsedProfile=userProfileSchema.safeParse(JSON.parse(savedProfile));
          if(!parsedProfile.success) {
            throw new Error("Сохранённый профиль повреждён. Вернитесь в чат и пройдите его ещё раз.");
          }
          profile=parsedProfile.data;
        } else {
          setNotice("Профиль не найден. Оценка не будет персонализирована, пока вы не заполните его в чате.");
        }
      } catch(error) {
        if(active) {
          setError(error instanceof Error?error.message:"Не удалось прочитать профиль.");
          setLoading(false);
        }
        return;
      }

      try {
        const response=await fetch("/api/recommendations",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({profile,swipes:readTraitSwipes()}),
        });
        const payload:unknown=await response.json();
        if(!response.ok)throw new Error(responseError(payload));

        const result=recommendationResponseSchema.safeParse(payload);
        if(!result.success)throw new Error("Сервер вернул рекомендации в неверном формате.");
        if(active) {
          setMatches(result.data.recommendations);
          setSource(result.data.source);
          if(result.data.catalogRecords!==undefined&&result.data.eligibleRecords!==undefined) {
            setCatalogCounts({
              total:result.data.catalogRecords,
              eligible:result.data.eligibleRecords,
              unavailable:result.data.unavailableRecords||0,
              unsupportedType:result.data.unsupportedTypeRecords||0,
              unconfirmedAvailability:result.data.unconfirmedAvailabilityRecords||0,
            });
          }
        }
      } catch(error) {
        if(active)setError(error instanceof Error?error.message:"Не удалось связаться с сервером.");
      } finally {
        if(active)setLoading(false);
      }
    }

    void loadRecommendations();
    return ()=>{active=false};
  },[]);

  if(loading) {
    return <main className="empty"><h1>Подбираем варианты…</h1><p>Проверяем условия и известные характеристики животных.</p></main>;
  }

  if(error) {
    return <main className="empty">
      <h1>Не удалось рассчитать подбор</h1>
      <p role="alert">{error}</p>
      <Link className="button" href="/chat">Вернуться к диалогу</Link>
    </main>;
  }

  if(matches.length===0) {
    return <main className="empty">
      <h1>Подтверждённых вариантов пока нет</h1>
      <p>Попробуйте уточнить условия или обратитесь к команде приюта.</p>
      {catalogCounts&&<p>{source==="demo"?"Тестовый каталог":"Источник — Supabase"}: доступно для сравнения {catalogCounts.eligible} из {catalogCounts.total} записей.
        {catalogCounts.unavailable>0&&` Недоступны для пристройства: ${catalogCounts.unavailable}.`}
        {catalogCounts.unsupportedType>0&&` Тип не распознан: ${catalogCounts.unsupportedType}.`}
        {catalogCounts.unconfirmedAvailability>0&&` Статус доступности не указан; по правилу каталога эти записи учитываются как доступные: ${catalogCounts.unconfirmedAvailability}.`}
      </p>}
      <Link className="button" href="/chat">Вернуться к диалогу</Link>
    </main>;
  }

  const top=matches[0];
  const animal=top.animal;
  const hasScoredMatch=matches.some(match=>match.score!==null);
  if(!hasScoredMatch&&top.swipeSignal<=0) {
    return <main className="empty">
      <h1>Пока недостаточно данных для подбора</h1>
      <p>Мы не будем показывать произвольный процент совместимости. Ответьте на вопросы в чате или оцените характеристики животных.</p>
      <Link className="button" href="/chat">Вернуться к диалогу</Link>
    </main>;
  }

  return <main className="results">
    <span className="eyebrow">{source==="demo"?"ТЕСТОВЫЕ ДАННЫЕ":source==="mixed"?"В БАЗЕ ЕСТЬ ТЕСТОВЫЕ КАРТОЧКИ":"КАТАЛОГ ИЗ БАЗЫ"} · Ориентировочная рекомендация</span>
    <h1>{top.score===null?"Варианты с учётом ваших свайпов":"Кажется, мы нашли пару!"}</h1>
    <p className="notice">{top.score===null
      ?"Данных недостаточно для расчёта процента. Варианты упорядочены только по реакциям на характеристики."
      :"Процент — оценка алгоритма, не вероятность успешного пристройства. Неизвестные сведения не считаются совпадениями; свайпы влияют только на порядок вариантов."}</p>
    {catalogCounts&&<p className="catalog-status" role="status">
      {source==="demo"?"Тестовые карточки":source==="mixed"?"Смешанный каталог":"Источник — Supabase"}: в подборе участвуют {catalogCounts.eligible} из {catalogCounts.total} записей.
      {catalogCounts.unavailable>0&&` Не доступны для пристройства: ${catalogCounts.unavailable}.`}
      {catalogCounts.unsupportedType>0&&` Тип не распознан: ${catalogCounts.unsupportedType}.`}
      {catalogCounts.unconfirmedAvailability>0&&` Статус доступности не указан; по правилу каталога эти записи учитываются как доступные: ${catalogCounts.unconfirmedAvailability}.`}
    </p>}
    {notice&&<p className="notice" role="status">{notice}</p>}
    <section className="best">
      {animal.image_url
        ?<img src={animal.image_url} alt={animal.name}/>
        :<div className="best-photo-placeholder">Фото не добавлено</div>}
      <div>
        <div className="score">{top.score===null?"—":`${top.score}%`}</div>
        <p className="data-completeness">Полнота данных для сравнения: {top.dataCompleteness}%</p>
        <h2>{animal.name}{animal.age_years!==null||animal.age_text?`, ${formatAnimalAge(animal)}`:""}</h2>
        <p>{animal.description}</p>
        <p className="notice" role="note"><strong>Почему этот вариант:</strong> {top.explanation}</p>
        <h3>Совпадения</h3>
        {top.matches.length
          ? <ul>{top.matches.map(item=><li key={item}>{item}</li>)}</ul>
          : <p>Пока нет подтверждённых совпадений по заполненным критериям.</p>}
        {top.mismatches.length>0&&<section className="result-notes">
          <h3>Несовпадения</h3>
          <ul>{top.mismatches.map(item=><li key={item}>{item}</li>)}</ul>
        </section>}
        {top.risks.length>0&&<section className="result-notes risk">
          <h3><AlertCircle/> Возможные сложности</h3>
          <ul>{top.risks.map(item=><li key={item}>{item}</li>)}</ul>
        </section>}
        {top.questions.length>0&&<section className="result-notes">
          <h3>Что уточнить</h3>
          <ul>{top.questions.map(item=><li key={item}>{item}</li>)}</ul>
        </section>}
        <div className="actions">
          <Link className="button" href={`/animals/${encodeURIComponent(animal.id)}`}>Подробнее <ArrowRight/></Link>
          <Link className="button ghost" href={`/adoption?animal=${encodeURIComponent(animal.id)}`}>Хочу познакомиться</Link>
        </div>
      </div>
    </section>
    {matches.length>1&&<>
      <h2>Ещё можно посмотреть</h2>
      <div className="grid">{matches.slice(1,5).map(match=><Link className="mini" href={`/animals/${encodeURIComponent(match.animal.id)}`} key={match.animal.id}>
        <img src={match.animal.image_url} alt=""/>
        <b>{match.animal.name}</b>
        <span>{match.score===null?"Недостаточно данных":`${match.score}% совпадение`}</span>
      </Link>)}</div>
    </>}
  </main>;
}
