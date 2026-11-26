"use client";
import {Suspense,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {animals as demoAnimals} from "@/lib/demo-data";
import {Animal} from "@/types/animal";

function AdoptionForm(){
  const id=useSearchParams().get("animal")||"";
  const [animalName,setAnimalName]=useState(()=>demoAnimals.find(item=>item.id===id)?.name);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    let active=true;
    if(!id)return;
    fetch("/api/animals")
      .then(response=>response.json())
      .then(data=>{
        const animal=data.animals?.find((item:Animal)=>item.id===id);
        if(active&&animal)setAnimalName(animal.name);
      })
      .catch(()=>{
        if(active)setError("Не удалось загрузить карточку. Заявку всё ещё можно отправить.");
      });
    return ()=>{active=false};
  },[id]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");
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
          animal_id:id||null,
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
          <button className="button" disabled={saving}>{saving?"Сохраняем…":"Сохранить заявку"}</button>
        </form>}
  </main>;
}

export default function Adoption(){return <Suspense fallback={<main className="form-page"><p>Загружаем форму…</p></main>}><AdoptionForm/></Suspense>}
