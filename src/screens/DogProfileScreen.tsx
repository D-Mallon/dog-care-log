import { supabase } from "../lib/supabase.ts";
import type { Dog, CareEvent } from "../types/core.ts";
import { useState } from "react";
import getTimeAgo from "../lib/utils.ts";

type DogProfileScreenProps = {
  dog: Dog;
  events: CareEvent[];
  onSave: () => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteDog: (dogId: string) => void;
  householdId: string;
  userIdInDB: string;
};

const EVENT_COLOURS: Record<
  string,
  { bg: string; text: string; emoji: string }
> = {
  feed: { bg: "bg-amber-50", text: "text-amber-800", emoji: "🍖" },
  walk: { bg: "bg-green-50", text: "text-green-800", emoji: "🦮" },
  toilet: { bg: "bg-yellow-50", text: "text-yellow-800", emoji: "🌿" },
  meds: { bg: "bg-rose-50", text: "text-rose-800", emoji: "💊" },
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    let imageUrl = props.dog.dogImage;

    if (newDogImageFile) {
      const filePath = `${props.householdId}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage
        .from("dog-images")
        .upload(filePath, newDogImageFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        setIsSubmitting(false);
        return;
      }

      const { data } = supabase.storage
        .from("dog-images")
        .getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

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
      console.error("Update error:", error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setIsEditing(false);
    setNewDogImageFile(null);
    setPreviewUrl(null);
    props.onSave();
  }

  const displayImage = previewUrl ?? (props.dog.dogImage || null);

  return (
    <div style={{ paddingTop: "1rem" }}>
      {/* Profile card */}
      <div className="w-full rounded-3xl p-6 shadow-sm bg-white border border-warm-brown/10 mb-6">
        {!isEditing ? (
          /* ── VIEW MODE ── */
          <div>
            <div className="flex items-start gap-5 mb-5">
              {/* Dog image */}
              <div className="flex-shrink-0">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={props.dog.dogName}
                    className="w-24 h-24 rounded-2xl object-cover"
                    style={{ border: "2px solid rgba(124, 92, 62, 0.15)" }}
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-2xl bg-light-tan flex items-center justify-center text-4xl"
                    style={{ border: "2px solid rgba(124, 92, 62, 0.15)" }}
                  >
                    🐾
                  </div>
                )}
              </div>

              {/* Dog details */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold font-fraunces text-warm-brown mb-3">
                  {props.dog.dogName}
                </h2>
                <div className="flex gap-4">
                  {props.dog.age != null && (
                    <div className="rounded-xl px-3 py-2 bg-amber-50">
                      <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">
                        Age
                      </p>
                      <p className="text-sm font-semibold text-amber-800">
                        {props.dog.age} yrs
                      </p>
                    </div>
                  )}
                  {props.dog.weight != null && (
                    <div className="rounded-xl px-3 py-2 bg-green-50">
                      <p className="text-xs text-green-600 font-medium uppercase tracking-wide">
                        Weight
                      </p>
                      <p className="text-sm font-semibold text-green-800">
                        {props.dog.weight} kg
                      </p>
                    </div>
                  )}
                  {props.dog.age == null && props.dog.weight == null && (
                    <p className="text-sm text-text-muted">
                      No details added yet
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
            >
              Edit profile
            </button>
          </div>
        ) : (
          /* ── EDIT MODE ── */
          <form onSubmit={handleSubmit}>
            {/* Image upload */}
            <div className="flex justify-center mb-6">
              <label className="cursor-pointer group">
                <div className="relative">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={props.dog.dogName}
                      className="w-28 h-28 rounded-2xl object-cover"
                      style={{ border: "2px solid rgba(124, 92, 62, 0.15)" }}
                    />
                  ) : (
                    <div
                      className="w-28 h-28 rounded-2xl bg-light-tan flex items-center justify-center text-4xl"
                      style={{ border: "2px dashed rgba(124, 92, 62, 0.3)" }}
                    >
                      🐾
                    </div>
                  )}
                  {/* Overlay hint */}
                  <div className="absolute inset-0 rounded-2xl bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">
                      Change
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-muted text-center mt-2">
                  Tap to change photo
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {/* Name input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream text-text-dark font-medium focus:outline-none focus:border-warm-brown"
                style={{ fontFamily: "DM Sans, sans-serif" }}
              />
            </div>

            {/* Age and weight */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Age (years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={editedAge}
                  onChange={(e) =>
                    setEditedAge(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="e.g. 3"
                  className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream text-text-dark focus:outline-none focus:border-warm-brown"
                  style={{ fontFamily: "DM Sans, sans-serif" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={editedWeight}
                  onChange={(e) =>
                    setEditedWeight(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="e.g. 28"
                  className="w-full px-4 py-3 rounded-xl border border-warm-brown/20 bg-cream text-text-dark focus:outline-none focus:border-warm-brown"
                  style={{ fontFamily: "DM Sans, sans-serif" }}
                />
              </div>
            </div>

            {/* Buttons */}
            {/* Buttons */}
            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-warm-brown hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>

            {/* Delete dog — separate row below save/cancel */}
            <div className="pt-4 border-t border-warm-brown/10">
              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  Remove {props.dog.dogName} from your pack
                </button>
              ) : (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
                  <p className="text-sm font-semibold text-rose-700 text-center mb-1">
                    Are you sure?
                  </p>
                  <p className="text-xs text-rose-500 text-center mb-4">
                    This will permanently delete {props.dog.dogName} and all
                    their events.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onDeleteDog(props.dog.dogId)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors"
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

      {/* Event history */}
      {sortedEvents.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--light-tan)" }}
        >
          <h2 className="text-lg font-semibold font-fraunces text-warm-brown mb-4">
            Event history
          </h2>
          <ul className="flex flex-col gap-2">
            {sortedEvents.slice(0, visibleEvents).map((event) => {
              const colours = EVENT_COLOURS[event.type] ?? {
                bg: "bg-gray-50",
                text: "text-gray-800",
                emoji: "📋",
              };
              return (
                <li
                  key={event.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl ${colours.bg}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{colours.emoji}</span>
                    <span
                      className={`text-sm font-semibold capitalize ${colours.text}`}
                    >
                      {event.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-muted">
                      {getTimeAgo(event.timestamp)}
                    </p>
                    {event.note && (
                      <p className="text-xs text-text-muted italic mt-0.5">
                        "{event.note}"
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => props.onDeleteEvent(event.id)}
                    className="text-xs text-rose-400 hover:text-rose-600 transition-colors ml-2 flex-shrink-0"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>

          {sortedEvents.length > visibleEvents && (
            <button
              onClick={() => setVisibleEvents((v) => v + 10)}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 bg-white/60 hover:bg-white transition-colors"
            >
              Load more ({sortedEvents.length - visibleEvents} remaining)
            </button>
          )}
        </div>
      )}

      {sortedEvents.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">
          No events logged yet for {props.dog.dogName}.
        </p>
      )}
    </div>
  );
}
