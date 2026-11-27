"use client";

import {usePathname} from "next/navigation";

export function SiteFooter() {
  const pathname=usePathname();
  if(pathname.startsWith("/ourpets"))return null;

  return <footer>НИКЕР · демонстрационный MVP · карточки животных содержат тестовые данные</footer>;
}
