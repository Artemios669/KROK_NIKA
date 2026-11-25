import "server-only";import {cookies} from "next/headers";import {createHmac,timingSafeEqual} from "crypto";
const name="niker_admin";const secret=()=>process.env.ADMIN_PASSWORD||"";
function token(){return createHmac("sha256",secret()).update("admin").digest("hex")}
export async function isAdmin(){if(!secret())return false;const value=(await cookies()).get(name)?.value||"";const expected=token();return value.length===expected.length&&timingSafeEqual(Buffer.from(value),Buffer.from(expected));}
export function adminCookie(){return {name,value:token(),httpOnly:true,sameSite:"lax" as const,secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*8};}
