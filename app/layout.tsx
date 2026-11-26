import type {Metadata} from "next";
import "./styles.css";
import {SiteHeader} from "@/components/site-header";

export const metadata:Metadata={
  title:"НИКЕР — подбор питомца",
  description:"Демонстрационный сервис подбора животных по образу жизни и предпочтениям.",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru">
    <body>
      <SiteHeader/>
      {children}
      <footer>НИКЕР · демонстрационный MVP · карточки животных содержат тестовые данные</footer>
    </body>
  </html>;
}
