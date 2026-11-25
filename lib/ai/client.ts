import "server-only";import OpenAI from "openai";
export function getOpenAI(){const key=process.env.OPENAI_API_KEY;return key?new OpenAI({apiKey:key}):null;}
