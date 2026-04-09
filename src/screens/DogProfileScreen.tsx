import { supabase } from "../lib/supabase.ts";
import type { Dog, CareEvent, WeightLog } from "../types/core.ts";
import { useState } from "react";
import getTimeAgo from "../lib/utils.ts";
import { EVENT_DISPLAY } from "../components/DogStatusCard.tsx";

type DogProfileScreenProps = {
  dog: Dog;
  events: CareEvent[];
  weightLogs: WeightLog[];
  onSave: () => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteDog: (dogId: string) => void;
  householdId: string;
  userIdInDB: string;
  onWeightLogged: () => void;
};
const EVENT_COLOURS: Record<
  string,
  { bg: string; text: string; emoji: string }
> = {
  feed: { bg: "bg-amber-50", text: "text-amber-800", emoji: "🍖" },
  walk: { bg: "bg-green-50", text: "text-green-800", emoji: "🦮" },
  toilet: { bg: "bg-yellow-50", text: "text-yellow-800", emoji: "🌿" },
  meds: { bg: "bg-rose-50", text: "text-rose-800", emoji: "💊" },
  sick: { bg: "bg-red-50", text: "text-red-800", emoji: "🤒" },
  nap_time: { bg: "bg-purple-50", text: "text-purple-800", emoji: "😴" },
  play_time: { bg: "bg-blue-50", text: "text-blue-800", emoji: "🎾" },
};

export default function DogProfileScreen(props: DogProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(props.dog.dogName);
  const [editedAge, setEditedAge] = useState<number | "">(props.dog.age ?? "");
  const [editedWeight, setEditedWeight] = useState<number | "">(
    props.dog.weight ?? "",
  );

  const [newDogImageFile, setNewDogImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleEvents, setVisibleEvents] = useState(10);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const sortedEvents = [...props.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const sortedWeights = [...props.weightLogs].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const latestWeight =
    editedWeight !== "" ? editedWeight : sortedWeights[0]?.weight;

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewDogImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditedName(props.dog.dogName);
    setEditedAge(props.dog.age ?? "");
    setEditedWeight(props.dog.weight ?? "");
    setPreviewUrl(null);
    setNewDogImageFile(null);
    setConfirmingDelete(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    let imageUrl = props.dog.dogImage;

    if (newDogImageFile) {
      const filePath = `${props.householdId}/${crypto.randomUUID()}`;
      const { error } = await supabase.storage
        .from("dog-images")
        .upload(filePath, newDogImageFile);

      if (error) {
        console.error(error);
        setIsSubmitting(false);
        return;
      }

      const { data } = supabase.storage
        .from("dog-images")
        .getPublicUrl(filePath);

      imageUrl = data.publicUrl;
    }

    // ✅ Update dog profile
    const { error } = await supabase
      .from("Dogs")
      .update({
        dogName: editedName,
        dogImage: imageUrl,
        age: editedAge === "" ? null : editedAge,
        weight: editedWeight === "" ? null : editedWeight,
      })
      .eq("dogId", props.dog.dogId);

    if (error) {
      console.error(error);
      setIsSubmitting(false);
      return;
    }

    // ✅ Log weight IF it changed
    const currentWeight = props.dog.weight ?? null;
    const newWeight = editedWeight === "" ? null : Number(editedWeight);

    if (newWeight !== currentWeight) {
      await supabase.from("WeightLog").insert({
        id: crypto.randomUUID(),
        dogId: props.dog.dogId,
        weight: editedWeight, // Keep editedWeight as is, it will be Number or "" so supabase should handle it
        recordedAt: new Date().toISOString(),
      });

      props.onWeightLogged();
    }

    setIsSubmitting(false);
    setIsEditing(false);
    props.onSave();
  }

  const displayImage = previewUrl ?? props.dog.dogImage;

  return (
    <div className="pt-4">
      {/* Profile Card */}
      <div className="w-full rounded-3xl p-6 bg-white border border-warm-brown/10 mb-6">
        {!isEditing ? (
          <>
            <div className="flex gap-5 mb-5">
              {/* Image */}
              <div>
                {displayImage ? (
                  <img
                    src={displayImage}
                    className="w-24 h-24 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-light-tan flex items-center justify-center text-4xl">
                    🐾
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-warm-brown mb-3">
                  {props.dog.dogName}
                </h2>

                <div className="flex gap-3">
                  {props.dog.age != null && (
                    <div className="px-3 py-2 rounded-xl bg-amber-50">
                      <p className="text-xs uppercase text-amber-600">Age</p>
                      <p className="text-sm font-semibold text-amber-800">
                        {props.dog.age} yrs
                      </p>
                    </div>
                  )}

                  {latestWeight != null && latestWeight !== "" && (
                    <div className="px-3 py-2 rounded-xl bg-green-50">
                      <p className="text-xs uppercase text-green-600">Weight</p>
                      <p className="text-sm font-semibold text-green-800">
                        {latestWeight} kg
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 hover:bg-light-tan"
            >
              Edit profile
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Title */}
            <h2 className="text-lg font-semibold text-warm-brown mb-4">
              Edit profile
            </h2>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Name
              </label>
              <input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream"
              />
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Dog Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-sm text-text-dark file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-warm-brown file:text-white hover:file:bg-warm-brown/90"
              />
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Image Preview"
                  className="mt-2 w-24 h-24 object-cover rounded-xl"
                />
              )}
            </div>

            {/* Age + Weight */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">
                  Age
                </label>
                <input
                  type="number"
                  value={editedAge}
                  onChange={(e) =>
                    setEditedAge(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={editedWeight}
                  onChange={(e) =>
                    setEditedWeight(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border border-warm-brown/20 text-warm-brown hover:bg-light-tan"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-warm-brown text-white hover:opacity-90"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-warm-brown/10">
              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-50"
                >
                  Remove {props.dog.dogName}
                </button>
              ) : (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
                  <p className="text-sm font-semibold text-rose-700 text-center mb-1">
                    Are you sure?
                  </p>
                  <p className="text-xs text-rose-500 text-center mb-4">
                    This will permanently delete {props.dog.dogName}.
                  </p>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="flex-1 py-2.5 rounded-xl border border-warm-brown/20 text-warm-brown"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onDeleteDog(props.dog.dogId)}
                      className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600"
                    >
                      Yes, remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Weight history */}
      {sortedWeights.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-light-tan">
          <h2 className="mb-3 font-semibold">Weight history ⚖️</h2>
          {sortedWeights.map((w) => (
            <div key={w.id} className="flex justify-between text-sm">
              <span>{w.weight} kg</span>
              <span>{getTimeAgo(w.recordedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Events */}
      <div className="p-4 rounded-2xl bg-light-tan">
        <h2 className="mb-3 font-semibold">Event history 🐾</h2>

        {sortedEvents.slice(0, visibleEvents).map((event) => {
          const c = EVENT_COLOURS[event.type] ?? {
            bg: "bg-gray-50",
            text: "text-gray-800",
            emoji: "📋",
          };

          return (
            <div
              key={event.id}
              className={`flex justify-between items-start p-3 rounded-xl mb-2 ${c.bg}`}
            >
              <div className="flex-1">
                <span className={`font-medium ${c.text}`}>
                  {c.emoji} {EVENT_DISPLAY[event.type].label}
                  {event.type === "toilet" &&
                    event.subtype &&
                    ` ${event.subtype === "pee" ? "💧" : event.subtype === "poo" ? "💩" : ""}`}
                  {event.isAccident && " ⚠️"}
                </span>
                {event.note && (
                  <p className="text-xs text-text-muted mt-1 italic">
                    "{event.note}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  {getTimeAgo(event.timestamp)}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm("Delete this event?")) {
                      props.onDeleteEvent(event.id);
                    }
                  }}
                  className="text-xs text-rose-400 hover:text-rose-600"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {sortedEvents.length > visibleEvents && (
          <button
            onClick={() => setVisibleEvents((v) => v + 10)}
            className="w-full py-2 mt-2 rounded-lg text-sm font-medium text-warm-brown hover:bg-warm-brown/10 transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
