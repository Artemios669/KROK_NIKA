"use client";

import {createContext,useContext,useState} from "react";
import type {ReactNode} from "react";

export type RoadmapStep="chat"|"swipes"|"compatibility";

type RoadmapContextValue={
  activeStep:RoadmapStep;
  setActiveStep:(step:RoadmapStep)=>void;
};

const RoadmapContext=createContext<RoadmapContextValue|null>(null);

export function RoadmapProvider({children}:{children:ReactNode}) {
  const [activeStep,setActiveStep]=useState<RoadmapStep>("chat");

  return <RoadmapContext.Provider value={{activeStep,setActiveStep}}>
    {children}
  </RoadmapContext.Provider>;
}

export function useRoadmap() {
  const context=useContext(RoadmapContext);
  if(!context)throw new Error("RoadmapProvider is missing.");
  return context;
}
