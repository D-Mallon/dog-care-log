import { useState } from "react";
import type { Dog } from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";

type AddDogScreenProps = {
  onSubmitDog: (newDog: Dog) => void;
  userIdInDB: string;
};

export default function RegisterNewDogScreen(props: AddDogScreenProps) {
  const [newDogName, setNewDogName] = useState<string>("");

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
            <input
              type="text"
              name="addNewDogName"
              onChange={(e) => setNewDogName(e.target.value)}
            />
            What is your dog's name?
          </label>
        </p>
        <button type="submit">Add Dog to your pack</button>
      </form>
    </>
  );
}
