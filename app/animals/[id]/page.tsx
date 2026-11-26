"use client";
import {useParams} from "next/navigation";
import Link from "next/link";
import {animals as demoAnimals} from "@/lib/demo-data";
import {useEffect,useState} from "react";
import {Animal} from "@/types/animal";
import {animalTypeLabel,formatAnimalAge} from "@/lib/animal-catalog";

type AnsweredQuestion={id:string;question:string;answer:string;answered_at:string};

export default function AnimalPage() {
  const {id}=useParams<{id:string}>();
  const [animal,setAnimal]=useState<Animal|undefined>(()=>demoAnimals.find(item=>item.id===id));
  const [catalogSource,setCatalogSource]=useState<"demo"|"supabase"|"mixed">("demo");
  const [idKind,setIdKind]=useState<"demo"|"uuid"|"text">("demo");
  const [loaded,setLoaded]=useState(false);
  const [question,setQuestion]=useState("");
  const [sent,setSent]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [answeredQuestions,setAnsweredQuestions]=useState<AnsweredQuestion[]>([]);
  const [loadingAnswers,setLoadingAnswers]=useState(false);
  const [answersError,setAnswersError]=useState("");

  useEffect(()=>{
    let active=true;
    fetch("/api/animals")
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Не удалось загрузить каталог.");
        return data;
      })
      .then(data=>{
        if(active) {
          setAnimal(data.animals?.find((item:Animal)=>item.id===id));
          setCatalogSource(data.source==="supabase"||data.source==="mixed"?data.source:"demo");
          setIdKind(data.idKind==="text"||data.idKind==="uuid"?data.idKind:"demo");
        }
      })
      .catch(()=>{
        if(active)setError("Не удалось загрузить данные животного.");
      })
      .finally(()=>{
        if(active)setLoaded(true);
      });
    return ()=>{active=false};
  },[id]);

  const isDatabaseAnimal=Boolean(
    animal&&catalogSource!=="demo"&&
    (catalogSource==="supabase"||!demoAnimals.some(item=>item.id===animal.id)),
  );

  useEffect(()=>{
    if(!isDatabaseAnimal)return;
    let active=true;
    setLoadingAnswers(true);
    const query=idKind==="uuid"
      ?`animal_id=${encodeURIComponent(id)}`
      :`source_animal_id=${encodeURIComponent(id)}`;
    fetch(`/api/questions?${query}`)
      .then(async response=>{
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||"Не удалось загрузить ответы.");
        return result.questions as AnsweredQuestion[];
      })
      .then(questions=>{
        if(active)setAnsweredQuestions(questions);
      })
      .catch(error=>{
        if(active)setAnswersError(error instanceof Error?error.message:"Не удалось загрузить ответы приюта.");
      })
      .finally(()=>{
        if(active)setLoadingAnswers(false);
      });
    return ()=>{active=false};
  },[id,idKind,isDatabaseAnimal]);

  async function sendQuestion() {
    setError("");
    setSaving(true);
    try {
      const response=await fetch("/api/questions",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          ...(idKind==="uuid"
            ?{animal_id:id}
            :{source_animal_id:id,source_animal_name:animal?.name}),
          question,
        }),
      });
      const result=await response.json();
      if(!response.ok) {
        setError(result.error||"Не удалось сохранить вопрос.");
        return;
      }
      setSent(true);
    } catch {
      setError("Не удалось связаться с сервером. Вопрос не сохранён.");
    } finally {
      setSaving(false);
    }
  }

  if(!animal) {
    return <main className="empty"><h1>{loaded?"Карточка не найдена":"Загружаем карточку…"}</h1></main>;
  }

  return (
    <main className="profile">
      {animal.image_url
        ?<img className="profile-img" src={animal.image_url} alt={animal.name}/>
        :<div className="profile-img trait-photo-placeholder">Фото не добавлено</div>}
      <section>
        <span className="demo">{isDatabaseAnimal?"ДАННЫЕ SUPABASE":"ТЕСТОВАЯ КАРТОЧКА"}</span>
        <h1>{animal.name}</h1>
        <p>{animal.description}</p>
        <div className="facts">
          <span>{animalTypeLabel(animal.type)}</span>
          <span>{formatAnimalAge(animal)}</span>
          <span>{animal.size}</span>
          <span>{animal.activity_level} активность</span>
        </div>
        {animal.shelter&&<p>Приют: {animal.shelter}</p>}
        <h3>Характер</h3>
        <div className="tags">{animal.character.map(item=><b key={item}>{item}</b>)}</div>
        {animal.care_notes&&<p><b>Особенности ухода:</b> {animal.care_notes}</p>}
        {animal.health_notes&&<p><b>Здоровье:</b> {animal.health_notes}</p>}
        <p>Пристройство: {animal.adoption_available?"доступно":"недоступно"} · Опека: {animal.guardianship_available?"доступна":"недоступна"}</p>
        <Link className="button" href={`/adoption?animal=${encodeURIComponent(animal.id)}`}>Оставить заявку</Link>
      </section>
      <section className="question">
        <h2>Хотите узнать больше?</h2>
        {isDatabaseAnimal&&<div className="answered-questions">
          <h3>Ответы приюта</h3>
          {loadingAnswers&&<p>Загружаем ответы…</p>}
          {answersError&&<p className="error">{answersError}</p>}
          {!loadingAnswers&&!answersError&&answeredQuestions.length===0&&<p>Пока нет опубликованных ответов.</p>}
          {answeredQuestions.map(item=><article className="answered-question" key={item.id}>
            <p><b>Вопрос:</b> {item.question}</p>
            <p><b>Ответ:</b> {item.answer}</p>
            <small>{new Date(item.answered_at).toLocaleDateString("ru-RU")}</small>
          </article>)}
        </div>}
        {isDatabaseAnimal
          ? <p>Вопрос будет сохранён в Supabase.</p>
          : <p>Это тестовая карточка. Чтобы отправить вопрос, подключите Supabase и выберите животное из базы.</p>}
        {sent
          ? <p className="success">Вопрос сохранён в Supabase. Это не означает, что его уже увидели сотрудники приюта.</p>
          : <>
              <textarea value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Ваш вопрос" disabled={!isDatabaseAnimal||saving}/>
              {error&&<p className="error">{error}</p>}
              <button className="button" disabled={!isDatabaseAnimal||question.trim().length<3||saving} onClick={sendQuestion}>
                {saving?"Сохраняем…":"Отправить вопрос"}
              </button>
            </>}
      </section>
    </main>
  );
}
