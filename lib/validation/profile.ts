import {z} from "zod";

const nullableText=z.string().max(120).nullable();
const careExperience=z.string().max(400).nullable();
export const userProfileSchema=z.object({
  housing:z.object({type:nullableText,size:nullableText,living_conditions:nullableText,yard_available:z.boolean().nullable()}),
  household:z.object({adults:z.number().int().min(0).max(20).nullable(),children:z.number().int().min(0).max(20).nullable(),children_ages:z.array(z.number().int().min(0).max(18)).max(10),other_animals:z.array(z.string().max(60)).max(10),other_animals_confirmed:z.boolean().nullable().optional().transform(value=>value??null)}),
  lifestyle:z.object({works_full_time:z.boolean().nullable(),hours_away_daily:z.number().min(0).max(24).nullable(),activity_level:z.enum(["low","moderate","high"]).nullable(),walks_per_day:z.number().int().min(0).max(10).nullable()}),
  experience:z.object({has_pet_experience:z.boolean().nullable(),care_experience:careExperience}),
  preferences:z.object({animal_type:z.enum(["dog","cat"]).nullable(),preferred_size:z.enum(["small","medium","large"]).nullable(),preferred_age:nullableText,activity:z.enum(["low","moderate","high"]).nullable(),character:z.array(z.string().max(60)).max(8),colors:z.array(z.string().max(60)).max(8)}),
  readiness:z.object({special_care:z.boolean().nullable(),financial_readiness_confirmed:z.boolean().nullable()}),
  missing_fields:z.array(z.string().max(100)).max(8),completed:z.boolean()
});
export type ValidatedProfile=z.infer<typeof userProfileSchema>;
