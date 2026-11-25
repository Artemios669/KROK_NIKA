import "server-only";
import {createClient} from "@supabase/supabase-js";

/** Returns null in demo mode so callers can safely use local test data. */
export function getSupabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url,key,{auth:{persistSession:false}}) : null;
}
