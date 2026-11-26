"use client";
import {Suspense,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {animals as demoAnimals} from "@/lib/demo-data";
import {Animal} from "@/types/animal";

function AdoptionForm(){
  const id=useSearchParams().get("animal")||"";
  const [animalName,setAnimalName]=useState(()=>demoAnimals.find(item=>item.id===id)?.name);
  const [idKind,setIdKind]=useState<"demo"|"uuid"|"text">("demo");
  const [isDatabaseAnimal,setIsDatabaseAnimal]=useState(false);
  const [loadingAnimal,setLoadingAnimal]=useState(Boolean(id));
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    let active=true;
    if(!id) {
      setLoadingAnimal(false);
      return;
    }
    fetch("/api/animals")
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Не удалось загрузить каталог.");
        return data;
      })
      .then(data=>{
        const animal=data.animals?.find((item:Animal)=>item.id===id);
        if(active) {
          if(animal)setAnimalName(animal.name);
          const source=data.source==="supabase"||data.source==="mixed";
          setIsDatabaseAnimal(Boolean(source&&animal));
          setIdKind(data.idKind==="text"||data.idKind==="uuid"?data.idKind:"demo");
        }
      })
      .catch(()=>{
        if(active)setError("Не удалось проверить карточку. Заявка не отправлена.");
      })
      .finally(()=>{if(active)setLoadingAnimal(false)});
    return ()=>{active=false};
  },[id]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");
    if(id&&!isDatabaseAnimal) {
      setError("Заявки по тестовым карточкам не сохраняются. Выберите животное из Supabase.");
      return;
    }
    setSaving(true);
    const form=new FormData(event.currentTarget);
    let userProfile=null;
    try {
      const storedProfile=localStorage.getItem("niker-profile");
      userProfile=storedProfile?JSON.parse(storedProfile):null;
    } catch {
      userProfile=null;
    }
    try {
      const response=await fetch("/api/adoption-requests",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          animal_id:id&&idKind==="uuid"?id:null,
          ...(id&&idKind==="text"?{source_animal_id:id,source_animal_name:animalName}:{}),
          contact_name:form.get("name"),
          contact_email:form.get("email"),
          message:form.get("message"),
          request_type:form.get("type"),
          user_profile:userProfile,
        }),
      });
      const result=await response.json();
      if(response.ok)setDone(true);
      else setError(result.error||"Не удалось сохранить заявку.");
    } catch {
      setError("Не удалось связаться с сервером. Заявка не сохранена.");
    } finally {
      setSaving(false);
    }
  }
  return <main className="form-page">
    <span className="demo">ЗАЯВКА В SUPABASE</span>
    <h1>{animalName?`Заявка: ${animalName}`:"Заявка на знакомство"}</h1>
    <p>Заявка появится в Supabase и в админ-панели. Это не подтверждение от приюта.</p>
    {done
      ? <p className="success">Заявка сохранена в Supabase. Реального подтверждения от приюта пока нет.</p>
      : <form onSubmit={submit}>
          <label>Ваше имя<input name="name" required maxLength={80}/></label>
          <label>Email<input name="email" required type="email" maxLength={120}/></label>
          <label>Тип обращения<select name="type"><option value="adoption">Знакомство / пристройство</option><option value="guardianship">Опека</option></select></label>
          <label>Сообщение<textarea name="message" maxLength={1000} placeholder="Расскажите немного о себе"/></label>
          {error&&<p className="error">{error}</p>}
          <button className="button" disabled={saving||loadingAnimal||(Boolean(id)&&!isDatabaseAnimal)}>{saving?"Сохраняем…":"Сохранить заявку"}</button>
        </form>}
  </main>;
}

export default function Adoption(){return <Suspense fallback={<main className="form-page"><p>Загружаем форму…</p></main>}><AdoptionForm/></Suspense>}
