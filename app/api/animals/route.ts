import {NextResponse} from "next/server";
import {getSupabase} from "@/lib/supabase/server";
import {animals as demoAnimals} from "@/lib/demo-data";

export async function GET(){
  const supabase=getSupabase();
  if(!supabase)return NextResponse.json({animals:demoAnimals,source:"demo"});
  const {data,error}=await supabase.from("animals").select("*").eq("adoption_available",true).order("last_updated",{ascending:false});
  // Empty database is not an error: showing demo cards keeps onboarding usable.
  if(error || !data?.length)return NextResponse.json({animals:demoAnimals,source:"demo",warning:error?.message});
  return NextResponse.json({animals:data,source:"supabase"});
}
