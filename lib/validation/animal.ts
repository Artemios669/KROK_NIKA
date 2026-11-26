import {z} from "zod";

export const animalSchema=z.object({
  id:z.string().min(1),
  name:z.string().trim().min(1),
  type:z.enum(["dog","cat","unknown"]),
  age_years:z.number().finite().min(0).nullable(),
  age_text:z.string().nullable().optional(),
  sex:z.enum(["male","female","unknown"]).nullish().transform(value=>value??"unknown"),
  size:z.enum(["small","medium","large","unknown"]).nullish().transform(value=>value??"unknown"),
  color:z.array(z.string()).nullish().transform(value=>value??[]),
  character:z.array(z.string()).nullish().transform(value=>value??[]),
  activity_level:z.enum(["low","moderate","high","unknown"]).nullish().transform(value=>value??"unknown"),
  housing_requirements:z.array(z.string()).nullish().transform(value=>value??[]),
  good_with_children:z.boolean().nullable(),
  good_with_cats:z.boolean().nullable(),
  good_with_dogs:z.boolean().nullable(),
  good_with_other_animals:z.boolean().nullable().optional(),
  can_stay_alone_hours:z.number().finite().min(0).nullable(),
  special_care:z.boolean().nullable(),
  description:z.string().nullish().transform(value=>value??""),
  image_url:z.string().nullish().transform(value=>value??""),
  adoption_available:z.boolean().nullish().transform(value=>value===true),
  guardianship_available:z.boolean().nullish().transform(value=>value===true),
  coat_details:z.string().nullable().optional(),
  ear_shape:z.string().nullable().optional(),
  shelter_story:z.string().nullable().optional(),
  health_notes:z.string().nullable().optional(),
  care_notes:z.string().nullable().optional(),
  interesting_facts:z.array(z.string()).nullish().transform(value=>value??[]),
  shelter:z.string().nullable().optional(),
});

export const animalsSchema=z.array(animalSchema);
