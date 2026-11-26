import {describe,expect,it} from "vitest";
import {normalizeImportedAnimal,normalizeImportedAnimals,formatAnimalAge} from "@/lib/animal-catalog";
import {matchAnimal} from "@/lib/matching";
import {emptyProfile} from "@/types/user";

describe("imported animal catalog normalization",()=>{
  it("maps text columns to typed fields without losing unknown values",()=>{
    const animal=normalizeImportedAnimal({
      id:"animal-42",
      name:"Рада",
      type:"Собака",
      age_years:"4",
      sex:"самка",
      size:"средний",
      color:"рыжий, белый",
      character:"спокойная; ласковая",
      activity_level:"умеренный",
      housing_requirements:"квартира | регулярные прогулки",
      good_with_children:"да",
      good_with_cats:"неизвестно",
      good_with_dogs:"нет",
      good_with_other_animals:"да",
      can_stay_alone_hours:"6 часов",
      special_care:"не требуется",
      description:"Описание из карточки",
      image_url:"https://example.test/legacy.jpg",
      image_gallery:'["https://example.test/rada.jpg"]',
      adoption_available:"да",
      guardianship_available:"нет",
      care_notes:"Нужен постепенный переход на новый корм.",
      shelter:"Городской приют",
    });

    expect(animal).toMatchObject({
      id:"animal-42",
      type:"dog",
      age_years:4,
      size:"medium",
      color:["рыжий","белый"],
      character:["спокойная","ласковая"],
      activity_level:"moderate",
      good_with_children:true,
      good_with_cats:null,
      good_with_dogs:false,
      good_with_other_animals:true,
      can_stay_alone_hours:6,
      special_care:false,
      adoption_available:true,
      image_url:"https://example.test/rada.jpg",
      care_notes:"Нужен постепенный переход на новый корм.",
      shelter:"Городской приют",
    });
  });

  it("keeps ambiguous age and compatibility unknown instead of guessing",()=>{
    const animal=normalizeImportedAnimal({
      id:"animal-unknown",
      name:"Питомец",
      type:"не указан",
      age_years:"примерно 2–3 года",
      good_with_children:"не проверено",
      good_with_cats:"не знаю",
      good_with_dogs:null,
      adoption_available:"неизвестно",
    });

    expect(animal).not.toBeNull();
    expect(animal?.type).toBe("unknown");
    expect(animal?.age_years).toBeNull();
    expect(animal?.age_text).toBe("примерно 2–3 года");
    expect(animal?.good_with_children).toBeNull();
    expect(animal?.good_with_cats).toBeNull();
    expect(animal?.adoption_available).toBe(false);
    expect(formatAnimalAge(animal!)).toBe("примерно 2–3 года");
    expect(matchAnimal(animal!,emptyProfile)).toBeNull();
  });

  it("reports rows without IDs instead of fabricating identifiers",()=>{
    const result=normalizeImportedAnimals([
      {id:"animal-1",name:"Кот",type:"Кот",adoption_available:"да"},
      {name:"Без ID",type:"Кошка",adoption_available:"неизвестно"},
    ]);

    expect(result.animals).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.unconfirmedAvailability).toBe(1);
  });

  it("can include imported records with missing availability when the catalog policy allows it",()=>{
    const result=normalizeImportedAnimals([
      {
        id:"animal-without-status",
        name:"Питомец",
        type:"dog",
        adoption_available:"отсутствует",
      },
      {
        id:"animal-explicitly-unavailable",
        name:"Питомец",
        type:"cat",
        adoption_available:"нет",
      },
    ],{assumeAvailableWhenUnknown:true});

    expect(result.animals[0].adoption_available).toBe(true);
    expect(result.animals[1].adoption_available).toBe(false);
    expect(result.unconfirmedAvailability).toBe(1);
    expect(result.unavailableRecords).toBe(1);
  });

  it("uses the first animal photo from image_gallery, skips the shelter logo, and does not fall back to image_url",()=>{
    const animal=normalizeImportedAnimal({
      id:"animal-gallery",
      name:"Питомец",
      type:"cat",
      image_url:"https://example.test/legacy.jpg",
      image_gallery:["https://fond-nika.ru/logo-nika.png","https://example.test/first.jpg","https://example.test/second.jpg"],
    });
    const noGalleryImage=normalizeImportedAnimal({
      id:"animal-no-gallery",
      name:"Питомец без фото",
      type:"cat",
      image_url:"https://example.test/legacy.jpg",
      image_gallery:[],
    });

    expect(animal?.image_url).toBe("https://example.test/first.jpg");
    expect(noGalleryImage?.image_url).toBe("");
  });
});
