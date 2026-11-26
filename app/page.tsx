import Link from "next/link";
import {ArrowRight,Heart,ShieldCheck,Sparkles} from "lucide-react";

const features=[
  {icon:Sparkles,label:"Подбор начинается с разговора"},
  {icon:ShieldCheck,label:"Известные ограничения учитываются"},
  {icon:Heart,label:"Рекомендация — ориентир для знакомства"},
];

export default function Home() {
  return <main className="home-page">
    <section className="home-hero">
      <div className="home-copy">
        <span className="eyebrow">Подбор питомца</span>
        <h1>Питомец, которому подходит ваш образ жизни</h1>
        <p>Ответьте на несколько вопросов. Мы сравним ваши условия с характеристиками животных и покажем, что стоит уточнить у приюта.</p>
        <div className="actions">
          <Link className="button" href="/chat">Начать подбор <ArrowRight size={17}/></Link>
          <Link className="button ghost" href="/discover">Оценить характеристики</Link>
        </div>
        <p className="home-note">Сейчас в каталоге тестовые карточки — это демонстрация работы сервиса.</p>
      </div>
      <img
        className="home-image"
        src="https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1100&q=80"
        alt="Собака в зелёном парке"
      />
    </section>
    <section className="feature-list" aria-label="О принципах подбора">
      {features.map(({icon:Icon,label})=><div className="feature-item" key={label}>
        <Icon size={20} aria-hidden="true"/>
        <span>{label}</span>
      </div>)}
    </section>
  </main>;
}
