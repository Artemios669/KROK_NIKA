import {describe,it,expect} from "vitest";
import {animals} from "@/lib/demo-data";
import {buildCharacteristicCards,SwipeReaction} from "@/lib/characteristics";
import {emptyProfile} from "@/types/user";
import {recommendations} from "@/lib/matching";

describe("characteristic swipes",()=>{
  it("builds no more than ten cards and hides animal names",()=>{
    const cards=buildCharacteristicCards(animals);
    expect(cards.length).toBeLessThanOrEqual(10);
    for(const card of cards)for(const animal of animals)expect(`${card.title} ${card.text}`).not.toContain(animal.name);
  });
  it("uses a photo from an animal that matches the displayed characteristic",()=>{
    const animal=animals.find(item=>item.color.length>0)!;
    const card=buildCharacteristicCards([animal]).find(item=>item.field==="color");
    expect(card?.imageUrl).toBe(animal.image_url);
    expect(card?.text).not.toContain(animal.name);
  });
  it("uses swipe reactions to rank animals without changing their match score",()=>{
    const [first,second]=animals;
    const card=buildCharacteristicCards([second]).find(item=>item.field==="color");
    expect(card).toBeDefined();
    const liked:SwipeReaction={cardId:card!.id,field:card!.field,value:card!.value,reaction:"like"};
    const base=recommendations([first,second],emptyProfile);
    const ranked=recommendations([first,second],emptyProfile,[liked]);
    expect(base[0].animal.id).toBe(first.id);
    expect(ranked[0].animal.id).toBe(second.id);
    expect(ranked.find(match=>match.animal.id===second.id)?.score).toBe(base.find(match=>match.animal.id===second.id)?.score);
  });
});
