"use client";
import {useState} from "react";
type DashboardRow={
  id:string;
  name?:string;
  type?:string;
  image_url?:string|null;
  animals?:{name:string}|null;
  animal_id?:string;
  contact_name?:string;
  contact_email?:string;
  question?:string;
  answer?:string|null;
  message?:string|null;
  request_type?:string;
  status?:string|null;
  created_at?:string;
  answered_at?:string|null;
  adoption_available?:boolean;
};
type DashboardData={animals:DashboardRow[];questions:DashboardRow[];requests:DashboardRow[];mode:string};

const requestStatusLabels:Record<string,string>={
  pending:"Новая",
  in_progress:"В работе",
  approved:"Одобрена",
  rejected:"Отказ",
};

export default function Admin(){
  const [password,setPassword]=useState("");
  const [data,setData]=useState<DashboardData|null>(null);
  const [error,setError]=useState("");
  const [actionMessage,setActionMessage]=useState("");
  const [answerDrafts,setAnswerDrafts]=useState<Record<string,string>>({});
  const [updatingId,setUpdatingId]=useState<string|null>(null);
  const [tab,setTab]=useState("Животные");

  async function refreshDashboard(){
    const response=await fetch("/api/admin/dashboard");
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Не удалось загрузить данные.");
    setData(result);
  }

  async function login(event:React.FormEvent){
    event.preventDefault();
    setError("");
    try {
      const response=await fetch("/api/admin/session",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({password}),
      });
      const result=await response.json();
      if(!response.ok){
        setError(result.error||"Не удалось войти.");
        return;
      }

      await refreshDashboard();
    } catch(error) {
      setError(error instanceof Error?error.message:"Не удалось связаться с сервером.");
    }
  }

  async function answerQuestion(event:React.FormEvent<HTMLFormElement>,id:string){
    event.preventDefault();
    setError("");
    setActionMessage("");
    setUpdatingId(id);
    try {
      const response=await fetch(`/api/admin/questions/${id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({answer:answerDrafts[id]||""}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Не удалось отправить ответ.");
      await refreshDashboard();
      setAnswerDrafts(current=>({...current,[id]:""}));
      setActionMessage("Ответ сохранён и доступен в карточке животного.");
    } catch(error) {
      setError(error instanceof Error?error.message:"Не удалось связаться с сервером.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateRequestStatus(id:string,status:string){
    setError("");
    setActionMessage("");
    setUpdatingId(id);
    try {
      const response=await fetch(`/api/admin/adoption-requests/${id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({status}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Не удалось изменить статус.");
      await refreshDashboard();
      setActionMessage("Статус заявки обновлён.");
    } catch(error) {
      setError(error instanceof Error?error.message:"Не удалось связаться с сервером.");
    } finally {
      setUpdatingId(null);
    }
  }

  if(!data){
    return <main className="form-page">
      <span className="demo">ЗАЩИЩЁННАЯ ПАНЕЛЬ</span>
      <h1>Вход администратора</h1>
      <p>Для чтения данных настройте <code>ADMIN_PASSWORD</code> и <code>SUPABASE_SERVICE_ROLE_KEY</code> в <code>.env.local</code>.</p>
      <form onSubmit={login}>
        <label>Пароль<input type="password" value={password} onChange={event=>setPassword(event.target.value)} required/></label>
        {error&&<p className="error">{error}</p>}
        <button className="button">Войти</button>
      </form>
    </main>;
  }

  const rows=tab==="Животные"?data.animals:tab==="Вопросы"?data.questions:data.requests;
  return <main className="admin">
    <span className="demo">ДАННЫЕ SUPABASE</span>
    <h1>Управление</h1>
    <div className="tabs">
      {["Животные","Вопросы","Заявки"].map(item=><button className={tab===item?"active":""} onClick={()=>setTab(item)} key={item}>{item}</button>)}
    </div>
    {error&&<p className="error">{error}</p>}
    {actionMessage&&<p className="success">{actionMessage}</p>}
    <div className="admin-list">
      {rows.length===0
        ? <p className="empty">Пока нет данных.</p>
        : rows.map((row,index)=><article className="admin-card" key={row.id||index}>
            {tab==="Животные"
              ? <div className="admin-card-heading">
                  {typeof row.image_url==="string"&&<img src={row.image_url} alt=""/>}
                  <div><b>{row.name||""}</b><span>{row.type==="cat"?"Кошка":"Собака"} · {row.adoption_available?"доступно":"не доступно"}</span></div>
                </div>
              : tab==="Вопросы"
                ? <>
                    <div className="admin-card-heading">
                      <div><b>{row.animals?.name||"Животное"}</b><span>{row.status==="answered"?"Ответ дан":"Ожидает ответа"}{row.created_at?` · ${new Date(row.created_at).toLocaleString("ru-RU")}`:""}</span></div>
                    </div>
                    <p className="admin-card-text">{row.question}</p>
                    {row.status==="answered"
                      ? <p className="admin-answer"><b>Ответ приюта:</b> {row.answer}</p>
                      : <form className="admin-action" onSubmit={event=>answerQuestion(event,row.id)}>
                          <label htmlFor={`answer-${row.id}`}>Ответ пользователю</label>
                          <textarea id={`answer-${row.id}`} value={answerDrafts[row.id]||""} onChange={event=>setAnswerDrafts(current=>({...current,[row.id]:event.target.value}))} maxLength={2000} required/>
                          <button className="button" disabled={updatingId===row.id||(answerDrafts[row.id]||"").trim().length<3}>{updatingId===row.id?"Отправляем…":"Ответить"}</button>
                        </form>}
                  </>
                : <>
                    <div className="admin-card-heading">
                      <div><b>{row.contact_name}</b><span>{row.contact_email} · {row.request_type==="guardianship"?"Опека":"Знакомство / пристройство"}</span></div>
                      <span className="admin-status">{requestStatusLabels[row.status||"pending"]||row.status}</span>
                    </div>
                    <p className="admin-card-text">Животное: {row.animals?.name||"не выбрано"}</p>
                    {row.message&&<p className="admin-card-text">{row.message}</p>}
                    <label className="admin-status-control">Статус заявки
                      <select value={row.status||"pending"} disabled={updatingId===row.id} onChange={event=>updateRequestStatus(row.id,event.target.value)}>
                        {Object.entries(requestStatusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}
                      </select>
                    </label>
                  </>}
          </article>)}
    </div>
  </main>;
}
