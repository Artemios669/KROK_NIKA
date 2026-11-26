import {z} from "zod";
import {animalSchema} from "@/lib/validation/animal";
import {userProfileSchema} from "@/lib/validation/profile";

export const swipeReactionSchema=z.object({
  cardId:z.string().min(1).max(1600),
  field:z.enum(["color","coat_details","character","activity_level","size","ear_shape","interesting_fact","shelter_story","health_notes","special_care"]),
  value:z.string().max(1200),
  reaction:z.enum(["like","dislike"]),
});

export const recommendationRequestSchema=z.object({
  profile:userProfileSchema,
  swipes:z.array(swipeReactionSchema).max(10).default([]),
}).superRefine((request,context)=>{
  const cardIds=new Set<string>();
  request.swipes.forEach((swipe,index)=>{
    if(cardIds.has(swipe.cardId)) {
      context.addIssue({
        code:z.ZodIssueCode.custom,
        path:["swipes",index,"cardId"],
        message:"Повторяющаяся реакция.",
      });
    }
    cardIds.add(swipe.cardId);
  });
});

export const matchSchema=z.object({
  animal:animalSchema,
  score:z.number().min(0).max(100).nullable(),
  dataCompleteness:z.number().min(0).max(100),
  explanation:z.string().min(1).max(1600),
  matches:z.array(z.string()),
  mismatches:z.array(z.string()),
  risks:z.array(z.string()),
  questions:z.array(z.string()),
  swipeSignal:z.number().min(-1).max(1),
});

export const recommendationResponseSchema=z.object({
  recommendations:z.array(matchSchema),
  source:z.enum(["demo","supabase","mixed"]),
});

export type RecommendationMatch=z.infer<typeof matchSchema>;
export type RecommendationResponse=z.infer<typeof recommendationResponseSchema>;
