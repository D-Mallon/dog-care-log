import { useState } from "react";
import type { Dog } from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";

type AddDogScreenProps = {
  onSubmitDog: (newDog: Dog) => void;
  householdId: string;
};

const inputClass =
  "w-full px-4 py-3 rounded-xl border-2 bg-cream text-text-dark text-sm font-dm-sans outline-none focus:border-warm-brown/50 transition-colors";
const labelClass =
  "block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2";

export default function RegisterNewDogScreen(props: AddDogScreenProps) {
  const [newDogName, setNewDogName] = useState<string>("");
  const [newDogAge, setNewDogAge] = useState<number | null>(null);
  const [newDogWeight, setNewDogWeight] = useState<number | null>(null);
  const [newDogImageFile, setNewDogImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewDogImageFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newDogName.trim()) {
      alert("Please enter your dog's name");
      return;
    }

    setIsSubmitting(true);
    let newDogImageUrl = "";

    if (newDogImageFile) {
      const filePath = `${props.householdId}/${crypto.randomUUID()}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dog-images")
        .upload(filePath, newDogImageFile);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        setIsSubmitting(false);
        return;
      }

      const { data } = supabase.storage
        .from("dog-images")
        .getPublicUrl(filePath);

      newDogImageUrl = data.publicUrl;
    }

    const newDog: Dog = {
      dogId: crypto.randomUUID(),
      dogName: newDogName,
      dogImage: newDogImageUrl,
      age: newDogAge ?? undefined,
      weight: newDogWeight ?? undefined,
      householdId: props.householdId,
    };

    const { error } = await supabase.from("Dogs").insert({
      householdId: props.householdId,
      dogId: newDog.dogId,
      dogName: newDog.dogName,
      dogImage: newDogImageUrl,
      age: newDogAge,
      weight: newDogWeight,
    });

    if (error) {
      console.error("Error inserting dog:", error);
      setIsSubmitting(false);
      return;
    }

    props.onSubmitDog(newDog);
  }

  return (
    <div className="pt-4">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-text-muted mb-1">
          growing your pack
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown m-0">
          Add a Dog
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-6 text-center">
          <label className="inline-block cursor-pointer">
            <div
              className={`w-24 h-24 mx-auto mb-2 overflow-hidden rounded-2xl border-2 border-dashed ${
                previewUrl
                  ? "border-transparent"
                  : "border-warm-brown/30 bg-light-tan"
              } flex items-center justify-center transition-colors`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">📷</span>
              )}
            </div>
            <p className="text-xs text-text-muted m-0">
              {previewUrl ? "Change photo" : "Add a photo"}
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        </div>

        <div className="mb-5">
          <label className={labelClass}>Dog's name *</label>
          <input
            type="text"
            placeholder="e.g. Bear K"
            className={inputClass}
            onChange={(e) => setNewDogName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <label className={labelClass}>Age (years)</label>
            <input
              type="number"
              min="0"
              max="30"
              placeholder="e.g. 3"
              className={inputClass}
              onChange={(e) =>
                setNewDogAge(e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div>
            <label className={labelClass}>Weight (kg)</label>
            <input
              type="number"
              min="0"
              max="200"
              placeholder="e.g. 28"
              className={inputClass}
              onChange={(e) =>
                setNewDogWeight(e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-150 ${
            isSubmitting
              ? "bg-warm-brown/30 text-white cursor-not-allowed"
              : "bg-warm-brown text-white hover:opacity-90 active:scale-98"
          }`}
        >
          {isSubmitting ? "Adding..." : "Add to your pack 🐾"}
        </button>
      </form>
    </div>
  );
}
