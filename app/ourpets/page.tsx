import type {Metadata} from "next";
import {NikaPetsDemo} from "@/components/nika-pets-demo";

export const metadata:Metadata={
  title:"Подопечные — демонстрация НИКИ",
  description:"Демонстрационная страница каталога животных с чатом-помощником.",
};

export default function OurPetsPage() {
  return <NikaPetsDemo/>;
}
