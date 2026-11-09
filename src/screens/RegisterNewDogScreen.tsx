import { useState } from "react";
import type {
  ActivityLevel,
  Dog,
  DogSex,
  DogSize,
  TrainingStage,
} from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";
import BreedCombobox from "../components/BreedCombobox.tsx";
import { ageYearsFromDateOfBirth } from "../lib/dogProfile.ts";

type AddDogScreenProps = {
  onSubmitDog: (newDog: Dog) => void;
  householdId: string;
};

const inputClass =
  "w-full px-4 py-3 rounded-xl border-2 border-warm-brown/20 bg-cream text-text-dark text-sm font-dm-sans outline-none focus:border-warm-brown/50 transition-colors";
const labelClass =
  "block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2";
const selectClass = `${inputClass} appearance-none`;

export default function RegisterNewDogScreen(props: AddDogScreenProps) {
  const [newDogName, setNewDogName] = useState("");
  const [breedId, setBreedId] = useState<string | undefined>();
  const [newDogBreed, setNewDogBreed] = useState("");
  const [sex, setSex] = useState<DogSex>("unknown");
  const [neutered, setNeutered] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [newDogWeight, setNewDogWeight] = useState<number | null>(null);
  const [adultWeightKg, setAdultWeightKg] = useState<number | null>(null);
  const [sizeCategory, setSizeCategory] = useState<DogSize | "">("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">("");
  const [trainingStage, setTrainingStage] = useState<TrainingStage | "">("");
  const [coatType, setCoatType] = useState("");
  const [foodType, setFoodType] = useState("");
  const [feedingSchedule, setFeedingSchedule] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [temperamentNotes, setTemperamentNotes] = useState("");
  const [newDogNotes, setNewDogNotes] = useState("");
  const [newDogImageFile, setNewDogImageFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewDogImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newDogName.trim()) {
      setSubmitError("Please enter your dog's name.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let newDogImageUrl = "";

      if (newDogImageFile) {
        const filePath = `${props.householdId}/${crypto.randomUUID()}`;
        const { error: uploadError } = await supabase.storage
          .from("dog-images")
          .upload(filePath, newDogImageFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("dog-images")
          .getPublicUrl(filePath);
        newDogImageUrl = data.publicUrl;
      }

      const computedAge = ageYearsFromDateOfBirth(dateOfBirth || undefined);

      const newDog: Dog = {
        dogId: crypto.randomUUID(),
        dogName: newDogName.trim(),
        breed: newDogBreed.trim() || undefined,
        breedId,
        sex,
        neutered,
        dateOfBirth: dateOfBirth || undefined,
        dogImage: newDogImageUrl,
        age: computedAge,
        weight: newDogWeight ?? undefined,
        adultWeightKg: adultWeightKg ?? undefined,
        sizeCategory: sizeCategory || undefined,
        activityLevel: activityLevel || undefined,
        trainingStage: trainingStage || undefined,
        coatType: coatType.trim() || undefined,
        foodType: foodType.trim() || undefined,
        feedingSchedule: feedingSchedule.trim() || undefined,
        allergies: allergies.trim() || undefined,
        medications: medications.trim() || undefined,
        medicalNotes: medicalNotes.trim() || undefined,
        temperamentNotes: temperamentNotes.trim() || undefined,
        notes: newDogNotes.trim() || undefined,
        householdId: props.householdId,
      };

      const { error: dogError } = await supabase.from("Dogs").insert({
        householdId: props.householdId,
        dogId: newDog.dogId,
        dogName: newDog.dogName,
        breed: newDogBreed.trim() || null,
        breedId: breedId ?? null,
        sex,
        neutered,
        dateOfBirth: dateOfBirth || null,
        dogImage: newDogImageUrl,
        age: computedAge ?? null,
        weight: newDogWeight,
        adultWeightKg,
        sizeCategory: sizeCategory || null,
        activityLevel: activityLevel || null,
        trainingStage: trainingStage || null,
        coatType: coatType.trim() || null,
        foodType: foodType.trim() || null,
        feedingSchedule: feedingSchedule.trim() || null,
        allergies: allergies.trim() || null,
        medications: medications.trim() || null,
        medicalNotes: medicalNotes.trim() || null,
        temperamentNotes: temperamentNotes.trim() || null,
        notes: newDogNotes.trim() || null,
      });

      if (dogError) throw dogError;

      if (newDogWeight !== null) {
        const { error: weightError } = await supabase
          .from("WeightLog")
          .insert({
            id: crypto.randomUUID(),
            dogId: newDog.dogId,
            weight: newDogWeight,
            recordedAt: new Date().toISOString(),
          });

        if (weightError) {
          console.error("Error creating initial weight log:", weightError);
        }
      }

      props.onSubmitDog(newDog);
    } catch (error) {
      console.error("Error adding dog:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Couldn't add your dog. Please try again.",
      );
      setIsSubmitting(false);
    }
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
        <p className="mt-2 text-sm text-text-muted">
          The basics take a minute. More detail helps Loggi understand your
          dog’s routine and give better guidance later.
        </p>
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
          <label htmlFor="dog-name" className={labelClass}>
            Dog's name *
          </label>
          <input
            id="dog-name"
            type="text"
            placeholder="e.g. Bear K"
            className={inputClass}
            onChange={(e) => setNewDogName(e.target.value)}
            required
          />
        </div>

        <div className="mb-5">
          <BreedCombobox
            breedId={breedId}
            breedName={newDogBreed}
            onChange={(selection) => {
              setBreedId(selection.breedId);
              setNewDogBreed(selection.breedName);
              if (selection.breed && !sizeCategory) {
                setSizeCategory(selection.breed.size);
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label htmlFor="dog-sex" className={labelClass}>
              Sex
            </label>
            <select
              id="dog-sex"
              className={selectClass}
              value={sex}
              onChange={(e) => setSex(e.target.value as DogSex)}
            >
              <option value="unknown">Not sure</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
          <div>
            <label htmlFor="dog-dob" className={labelClass}>
              Date of birth
            </label>
            <input
              id="dog-dob"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="dog-weight" className={labelClass}>
              Current weight (kg)
            </label>
            <input
              id="dog-weight"
              type="number"
              min="0.1"
              max="200"
              step="0.1"
              placeholder="e.g. 28"
              className={inputClass}
              onChange={(e) =>
                setNewDogWeight(e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div>
            <label htmlFor="dog-adult-weight" className={labelClass}>
              Expected adult weight (kg)
            </label>
            <input
              id="dog-adult-weight"
              type="number"
              min="0.1"
              max="200"
              step="0.1"
              placeholder="Optional"
              className={inputClass}
              onChange={(e) =>
                setAdultWeightKg(e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
        </div>

        <details className="mb-6 rounded-2xl border border-warm-brown/15 bg-light-tan/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-warm-brown">
            Add more details (optional)
          </summary>
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-2 text-sm text-text-dark">
              <input
                type="checkbox"
                checked={neutered}
                onChange={(e) => setNeutered(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-warm-brown focus:ring-warm-brown"
              />
              Neutered / spayed
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="dog-size" className={labelClass}>
                  Size
                </label>
                <select
                  id="dog-size"
                  className={selectClass}
                  value={sizeCategory}
                  onChange={(e) =>
                    setSizeCategory(e.target.value as DogSize | "")
                  }
                >
                  <option value="">Not sure</option>
                  <option value="toy">Toy</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="giant">Giant</option>
                </select>
              </div>
              <div>
                <label htmlFor="dog-activity" className={labelClass}>
                  Activity level
                </label>
                <select
                  id="dog-activity"
                  className={selectClass}
                  value={activityLevel}
                  onChange={(e) =>
                    setActivityLevel(e.target.value as ActivityLevel | "")
                  }
                >
                  <option value="">Not sure</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="very_high">Very high</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="dog-training-stage" className={labelClass}>
                  Life stage
                </label>
                <select
                  id="dog-training-stage"
                  className={selectClass}
                  value={trainingStage}
                  onChange={(e) =>
                    setTrainingStage(e.target.value as TrainingStage | "")
                  }
                >
                  <option value="">Not sure</option>
                  <option value="puppy">Puppy</option>
                  <option value="adolescent">Adolescent</option>
                  <option value="adult">Adult</option>
                  <option value="senior">Senior</option>
                </select>
              </div>
              <div>
                <label htmlFor="dog-coat" className={labelClass}>
                  Coat type
                </label>
                <input
                  id="dog-coat"
                  type="text"
                  placeholder="e.g. short, double, curly"
                  value={coatType}
                  onChange={(e) => setCoatType(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="dog-food" className={labelClass}>
                  Food type
                </label>
                <input
                  id="dog-food"
                  type="text"
                  placeholder="e.g. dry puppy food"
                  value={foodType}
                  onChange={(e) => setFoodType(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="dog-feeding-schedule" className={labelClass}>
                  Feeding schedule
                </label>
                <input
                  id="dog-feeding-schedule"
                  type="text"
                  placeholder="e.g. 7am, 12pm, 5pm"
                  value={feedingSchedule}
                  onChange={(e) => setFeedingSchedule(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="dog-allergies" className={labelClass}>
                Allergies
              </label>
              <input
                id="dog-allergies"
                type="text"
                placeholder="Food, environment or medication allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="dog-medications" className={labelClass}>
                Medications
              </label>
              <input
                id="dog-medications"
                type="text"
                placeholder="Current medications and doses"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="dog-medical-notes" className={labelClass}>
                Medical notes
              </label>
              <textarea
                id="dog-medical-notes"
                rows={2}
                maxLength={1000}
                placeholder="Conditions, vet instructions, past injuries"
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div>
              <label htmlFor="dog-temperament" className={labelClass}>
                Temperament notes
              </label>
              <textarea
                id="dog-temperament"
                rows={2}
                maxLength={500}
                placeholder="Shy, reactive, loves other dogs, nervous of stairs…"
                value={temperamentNotes}
                onChange={(e) => setTemperamentNotes(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </details>

        <div className="mb-6">
          <label htmlFor="dog-notes" className={labelClass}>
            General notes (optional)
          </label>
          <textarea
            id="dog-notes"
            rows={3}
            maxLength={500}
            placeholder="Anything else worth knowing…"
            value={newDogNotes}
            onChange={(e) => setNewDogNotes(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>

        {submitError && (
          <p role="alert" className="mb-4 text-sm text-rose-700">
            {submitError}
          </p>
        )}

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
