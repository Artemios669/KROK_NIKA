import "server-only";
import {createClient} from "@supabase/supabase-js";

/** Public API operations use the anon key and are constrained by RLS. */
export function getSupabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url,key,{auth:{persistSession:false}}) : null;
}

/** Admin reads must use a server-only key; never expose it to browser code. */
export function getSupabaseAdmin() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url,key,{auth:{persistSession:false}}) : null;
}

export function getAnimalsTableName() {
  const table=process.env.SUPABASE_ANIMALS_TABLE?.trim()||"animals";
  if(table!=="animals"&&table!=="animalsss") {
    throw new Error("SUPABASE_ANIMALS_TABLE must be either animals or animalsss.");
  }
  return table;
}
