import { useState } from "react";
import type { Dog } from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";

type AddDogScreenProps = {
  onSubmitDog: (newDog: Dog) => void;
  userIdInDB: string;
};

export default function RegisterNewDogScreen(props: AddDogScreenProps) {
  const [newDogName, setNewDogName] = useState<string>("");
  const [newDogAge, setNewDogAge] = useState<Number | null>(null);
  const [newDogWeight, setNewDogWeight] = useState<Number | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newDog: Dog = {
      dogOwner: props.userIdInDB,
      dogId: crypto.randomUUID(),
      dogName: newDogName,
      dogImage: "", // Replace with actual image URL if available
    };

    const { error } = await supabase.from("Dogs").insert({
      userId: props.userIdInDB,
      dogId: newDog.dogId,
      dogName: newDog.dogName,
      dogImage: "",
      age: newDogAge,
      weight: newDogWeight,
    });

    if (error) {
      console.error("Error inserting new dog into database:", error);
      return;
    }

    props.onSubmitDog(newDog);

    console.log("Submitting add dog form with values:");
    console.log("New Dog Name:", newDogName);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <h1>Add a new dog</h1>
        <hr />
        <p>
          <label>
            What is your dog's name?
            <input
              type="text"
              name="addNewDogName"
              onChange={(e) => setNewDogName(e.target.value)}
            />
          </label>
          Age?{" "}
          <label>
            <input
              type="text"
              name="addNewDogAge"
              onChange={(e) =>
                setNewDogAge(e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
          Weight
          <label>
            <input
              type="text"
              name="addNewDogWeight"
              onChange={(e) =>
                setNewDogWeight(e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
        </p>
        <button type="submit">Add Dog to your pack</button>
      </form>
    </>
  );
}
