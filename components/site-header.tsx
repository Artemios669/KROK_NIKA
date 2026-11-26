"use client";

import {useState} from "react";
import Link from "next/link";
import {Menu,PawPrint,X} from "lucide-react";

const navigation=[
  {href:"/chat",label:"Подбор",className:"nav-chat"},
  {href:"/discover",label:"Характеристики"},
  {href:"/admin",label:"Демо-панель"},
];

export function SiteHeader() {
  const [menuOpen,setMenuOpen]=useState(false);

  return <header className="site-header">
    <div className="site-header-inner">
      <Link className="brand" href="/" onClick={()=>setMenuOpen(false)}>
        <PawPrint size={22} strokeWidth={2.2}/>
        <span>НИКЕР</span>
      </Link>
      <nav className={`site-nav${menuOpen?" is-open":""}`} id="site-navigation" aria-label="Основная навигация">
        {navigation.map(item=><Link
          href={item.href}
          className={item.className}
          key={item.href}
          onClick={()=>setMenuOpen(false)}
        >{item.label}</Link>)}
      </nav>
      <div className="header-actions">
        <Link className="button header-cta" href="/chat">Начать подбор</Link>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen?"Закрыть меню":"Открыть меню"}
          aria-controls="site-navigation"
          aria-expanded={menuOpen}
          onClick={()=>setMenuOpen(open=>!open)}
        >{menuOpen?<X size={21}/>:<Menu size={21}/>}</button>
      </div>
    </div>
  </header>;
}
