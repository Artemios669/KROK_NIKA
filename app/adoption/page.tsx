"use client";
import {Suspense,useState} from "react";
import {useSearchParams} from "next/navigation";
import {animals} from "@/lib/demo-data";

function AdoptionForm(){
  const id=useSearchParams().get("animal")||"";
  const animal=animals.find(item=>item.id===id);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/adoption-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({animal_id:id,contact_name:form.get("name"),contact_email:form.get("email"),message:form.get("message"),request_type:form.get("type"),user_profile:JSON.parse(localStorage.getItem("niker-profile")||"null")})});
    if(response.ok)setDone(true);
    else setError("Не удалось сохранить заявку. Проверьте заполнение полей.");
  }
  return <main className="form-page"><span className="demo">ДЕМОНСТРАЦИОННАЯ СИСТЕМА</span><h1>{animal?`Заявка: ${animal.name}`:"Заявка на знакомство"}</h1><p>Заявка сохранится в Supabase только для карточек, уже внесённых в базу. Это не подтверждение от приюта.</p>{done?<p className="success">Заявка сохранена. Реального подтверждения от приюта не будет.</p>:<form onSubmit={submit}><label>Ваше имя<input name="name" required maxLength={80}/></label><label>Email<input name="email" required type="email" maxLength={120}/></label><label>Тип обращения<select name="type"><option value="adoption">Знакомство / пристройство</option><option value="guardianship">Опека</option></select></label><label>Сообщение<textarea name="message" maxLength={1000} placeholder="Расскажите немного о себе"/></label>{error&&<p className="error">{error}</p>}<button className="button">Сохранить заявку</button></form>}</main>;
}

export default function Adoption(){return <Suspense fallback={<main className="form-page"><p>Загружаем форму…</p></main>}><AdoptionForm/></Suspense>}
