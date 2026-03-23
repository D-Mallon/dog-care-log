import { useState } from "react";
import type { Dog } from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";

type AddDogScreenProps = {
  onSubmitDog: (newDog: Dog) => void;
  userIdInDB: string;
};

export default function RegisterNewDogScreen(props: AddDogScreenProps) {
  const [newDogName, setNewDogName] = useState<string>("");
  const [newDogAge, setNewDogAge] = useState<number | null>(null);
  const [newDogWeight, setNewDogWeight] = useState<number | null>(null);
  const [newDogImageFile, setNewDogImageFile] = useState<File | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let newDogImageUrl = "";

    // Step 1 — upload image if one was selected
    if (newDogImageFile) {
      const filePath = `${props.userIdInDB}/${crypto.randomUUID()}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dog-images")
        .upload(filePath, newDogImageFile);

      console.log("Upload result:", uploadData);
      console.log("Upload error:", uploadError);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        return;
      }

      // Step 2 — get the public URL
      const { data } = supabase.storage
        .from("dog-images")
        .getPublicUrl(filePath);

      newDogImageUrl = data.publicUrl;
    }

    // Step 3 — build the dog object with the URL
    const newDog: Dog = {
      dogId: crypto.randomUUID(),
      dogOwner: props.userIdInDB,
      dogName: newDogName,
      dogImage: newDogImageUrl,
    };

    if (!newDogName.trim()) {
      alert("Please enter your dog's name");
      return;
    }

    // Step 4 — insert into database
    const { error } = await supabase.from("Dogs").insert({
      userId: props.userIdInDB,
      dogId: newDog.dogId,
      dogName: newDog.dogName,
      dogImage: newDogImageUrl,
      age: newDogAge,
      weight: newDogWeight,
    });

    if (error) {
      console.error("Error inserting dog:", error);
      return;
    }

    props.onSubmitDog(newDog);
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
          <label>
            Add a photo of your dog?
            <input
              type="file"
              accept="image/*"
              name="addNewDogImage"
              onChange={(e) => setNewDogImageFile(e.target.files?.[0] ?? null)}
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
