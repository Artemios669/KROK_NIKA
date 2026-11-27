"use client";

import {usePathname} from "next/navigation";
import Link from "next/link";
import {Check,PawPrint} from "lucide-react";
import {RoadmapStep,useRoadmap} from "@/components/roadmap-context";

const steps:{id:RoadmapStep;label:string}[]=[
  {id:"chat",label:"Чат"},
  {id:"swipes",label:"Свайпы"},
  {id:"compatibility",label:"Совместимость"},
];

export function SiteHeader({embedded=false}:{embedded?:boolean}={}) {
  const pathname=usePathname();
  const {activeStep}=useRoadmap();
  const currentStep=embedded||pathname==="/chat"
    ?activeStep
    :pathname==="/discover"
      ?"swipes"
      :pathname==="/results"||pathname.startsWith("/animals/")||pathname==="/adoption"
        ?"compatibility"
        :"chat";
  const currentIndex=steps.findIndex(step=>step.id===currentStep);
  const isAdmin=pathname==="/admin"||pathname.startsWith("/admin/");

  if(pathname.startsWith("/ourpets")&&!embedded)return null;

  return <header className={`site-header${embedded?" site-header-embedded":""}`}>
    <div className="site-header-inner">
      <Link className="brand" href="/">
        <PawPrint size={22} strokeWidth={2.2}/>
        <span>НИКЕР</span>
      </Link>
      {!isAdmin&&<ol className="roadmap" aria-label="Этапы подбора">
        {steps.map((step,index)=>{
          const status=index<currentIndex?"complete":index===currentIndex?"current":"upcoming";
          return <li
            className={`roadmap-step is-${status}`}
            aria-current={status==="current"?"step":undefined}
            key={step.id}
          >
            <span className="roadmap-marker" aria-hidden="true">
              {status==="complete"?<Check size={14} strokeWidth={2.5}/>:index+1}
            </span>
            <span className="roadmap-label">{step.label}</span>
            {index<steps.length-1&&<span className="roadmap-connector" aria-hidden="true"/>}
          </li>;
        })}
      </ol>}
    </div>
  </header>;
}
