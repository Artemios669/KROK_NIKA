import type {Metadata} from "next";
import "./styles.css";
import {SiteHeader} from "@/components/site-header";
import {SiteFooter} from "@/components/site-footer";
import {RoadmapProvider} from "@/components/roadmap-context";

export const metadata:Metadata={
  title:"НИКЕР — подбор питомца",
  description:"Демонстрационный сервис подбора животных по образу жизни и предпочтениям.",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru">
    <body>
      <RoadmapProvider>
        <SiteHeader/>
        {children}
        <SiteFooter/>
      </RoadmapProvider>
    </body>
  </html>;
}
