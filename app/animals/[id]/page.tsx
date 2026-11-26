"use client";
import {useParams} from "next/navigation";
import Link from "next/link";
import {animals as demoAnimals} from "@/lib/demo-data";
import {useEffect,useState} from "react";
import {Animal} from "@/types/animal";

const databaseIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type AnsweredQuestion={id:string;question:string;answer:string;answered_at:string};

export default function AnimalPage() {
  const {id}=useParams<{id:string}>();
  const [animal,setAnimal]=useState<Animal|undefined>(()=>demoAnimals.find(item=>item.id===id));
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
      .then(response=>response.json())
      .then(data=>{
        if(active)setAnimal(data.animals?.find((item:Animal)=>item.id===id));
      })
      .catch(()=>{
        if(active)setError("Не удалось загрузить данные животного.");
      })
      .finally(()=>{
        if(active)setLoaded(true);
      });
    return ()=>{active=false};
  },[id]);

  useEffect(()=>{
    if(!databaseIdPattern.test(id))return;
    let active=true;
    setLoadingAnswers(true);
    fetch(`/api/questions?animal_id=${encodeURIComponent(id)}`)
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
  },[id]);

  async function sendQuestion() {
    setError("");
    setSaving(true);
    try {
      const response=await fetch("/api/questions",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({animal_id:id,question}),
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

  const isDatabaseAnimal=databaseIdPattern.test(animal.id);

  return (
    <main className="profile">
      <img className="profile-img" src={animal.image_url} alt={animal.name}/>
      <section>
        <span className="demo">{isDatabaseAnimal?"ДАННЫЕ SUPABASE":"ТЕСТОВАЯ КАРТОЧКА"}</span>
        <h1>{animal.name}</h1>
        <p>{animal.description}</p>
        <div className="facts">
          <span>{animal.type==="cat"?"Кошка":"Собака"}</span>
          <span>{animal.age_years} лет</span>
          <span>{animal.size}</span>
          <span>{animal.activity_level} активность</span>
        </div>
        <h3>Характер</h3>
        <div className="tags">{animal.character.map(item=><b key={item}>{item}</b>)}</div>
        <p>Пристройство: {animal.adoption_available?"доступно":"недоступно"} · Опека: {animal.guardianship_available?"доступна":"недоступна"}</p>
        <Link className="button" href={`/adoption?animal=${animal.id}`}>Оставить заявку</Link>
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
