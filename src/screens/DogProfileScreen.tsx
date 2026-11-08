import { supabase } from "../lib/supabase.ts";
import type { Dog, CareEvent, WeightLog } from "../types/core.ts";
import { useState } from "react";
import getTimeAgo from "../lib/utils.ts";
import { EVENT_DISPLAY } from "../lib/eventMeta.ts";
import {
  buildDogExportCsv,
  dogExportFilename,
} from "../lib/dogExport.ts";
import { getPottyInsights } from "../lib/predictions.ts";
import EditEventModal from "../components/EditEventModal.tsx";
import Modal from "../components/Modal.tsx";

type DogProfileScreenProps = {
  dog: Dog;
  events: CareEvent[];
  weightLogs: WeightLog[];
  onSave: () => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteDog: (dogId: string) => void;
  householdId: string;
  userIdInDB: string;
  isOwner: boolean;
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
  water: { bg: "bg-cyan-50", text: "text-cyan-800", emoji: "💧" },
  grooming: { bg: "bg-orange-50", text: "text-orange-800", emoji: "✂️" },
};

export default function DogProfileScreen(props: DogProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(props.dog.dogName);
  const [editedBreed, setEditedBreed] = useState(props.dog.breed ?? "");
  const [editedAge, setEditedAge] = useState<number | "">(props.dog.age ?? "");
  const [editedWeight, setEditedWeight] = useState<number | "">(
    props.dog.weight ?? "",
  );

  const [newDogImageFile, setNewDogImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleEvents, setVisibleEvents] = useState(10);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<
    string | null
  >(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [weightError, setWeightError] = useState<string | null>(null);
  const [weightPending, setWeightPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sortedEvents = [...props.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const editingEvent =
    sortedEvents.find((event) => event.id === editingEventId) ?? null;

  const sortedWeights = [...props.weightLogs].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const latestWeight = sortedWeights[0]?.weight ?? props.dog.weight;

  const pottyInsights = getPottyInsights(props.events);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setNewDogImageFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditedName(props.dog.dogName);
    setEditedBreed(props.dog.breed ?? "");
    setEditedAge(props.dog.age ?? "");
    setEditedWeight(props.dog.weight ?? "");
    setPreviewUrl(null);
    setNewDogImageFile(null);
    setConfirmingDelete(false);
    setSaveError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!editedName.trim()) {
      setSaveError("Your dog needs a name.");
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);

    let imageUrl = props.dog.dogImage;

    if (newDogImageFile) {
      const filePath = `${props.householdId}/${crypto.randomUUID()}`;
      const { error } = await supabase.storage
        .from("dog-images")
        .upload(filePath, newDogImageFile);

      if (error) {
        console.error(error);
        setSaveError("Couldn't upload the new photo. Please try again.");
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
        dogName: editedName.trim(),
        breed: editedBreed.trim() || null,
        dogImage: imageUrl,
        age: editedAge === "" ? null : editedAge,
        weight: editedWeight === "" ? null : editedWeight,
      })
      .eq("dogId", props.dog.dogId);

    if (error) {
      console.error(error);
      setSaveError("Couldn't save the profile. Please try again.");
      setIsSubmitting(false);
      return;
    }

    // ✅ Log weight IF it changed
    const currentWeight = props.dog.weight ?? null;
    const nextWeight = editedWeight === "" ? null : Number(editedWeight);

    if (nextWeight !== currentWeight && nextWeight !== null) {
      const { error: weightError } = await supabase
        .from("WeightLog")
        .insert({
          id: crypto.randomUUID(),
          dogId: props.dog.dogId,
          weight: nextWeight,
          recordedAt: new Date().toISOString(),
        });

      if (weightError) {
        console.error("Error logging weight:", weightError);
        setSaveError(
          "Profile saved, but the weight history entry couldn't be added.",
        );
      }

      props.onWeightLogged();
    }

    setIsSubmitting(false);
    setIsEditing(false);
    props.onSave();
  }

  function handleExport() {
    const eventLabels = Object.fromEntries(
      Object.entries(EVENT_DISPLAY).map(([type, meta]) => [type, meta.label]),
    ) as Record<string, string>;
    const csv = buildDogExportCsv(
      props.dog,
      props.events,
      props.weightLogs,
      eventLabels,
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = dogExportFilename(props.dog.dogName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleLogWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weight = Number(weightInput);

    if (!Number.isFinite(weight) || weight <= 0) {
      setWeightError("Enter a weight greater than zero.");
      return;
    }

    setWeightPending(true);
    setWeightError(null);

    const { error } = await supabase.from("WeightLog").insert({
      id: crypto.randomUUID(),
      dogId: props.dog.dogId,
      weight,
      recordedAt: new Date().toISOString(),
    });

    if (error) {
      console.error("Error logging weight:", error);
      setWeightError("Couldn't save that weight. Please try again.");
    } else {
      setWeightInput("");
      props.onWeightLogged();
    }

    setWeightPending(false);
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
                    alt={props.dog.dogName}
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

                <div className="flex flex-wrap gap-3">
                  {props.dog.breed && (
                    <div className="px-3 py-2 rounded-xl bg-purple-50">
                      <p className="text-xs uppercase text-purple-600">Breed</p>
                      <p className="text-sm font-semibold text-purple-800">
                        {props.dog.breed}
                      </p>
                    </div>
                  )}

                  {props.dog.age != null && (
                    <div className="px-3 py-2 rounded-xl bg-amber-50">
                      <p className="text-xs uppercase text-amber-600">Age</p>
                      <p className="text-sm font-semibold text-amber-800">
                        {props.dog.age} yrs
                      </p>
                    </div>
                  )}

                  {latestWeight != null && (
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

            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 hover:bg-light-tan"
              >
                Edit profile
              </button>
              <button
                onClick={handleExport}
                className="py-2.5 px-4 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 hover:bg-light-tan"
                title="Export data as CSV"
              >
                📥
              </button>
            </div>
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

            {/* Breed */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                Breed
              </label>
              <input
                value={editedBreed}
                onChange={(e) => setEditedBreed(e.target.value)}
                placeholder="e.g. Golden Retriever"
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
                  min="0.1"
                  step="0.1"
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

            {saveError && (
              <p role="alert" className="mb-4 text-sm text-rose-700">
                {saveError}
              </p>
            )}

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
              {!props.isOwner ? (
                <p className="text-xs text-text-muted text-center">
                  Only the household owner can remove a dog.
                </p>
              ) : !confirmingDelete ? (
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

      {/* Potty Predictions */}
      {pottyInsights && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
          <h2 className="mb-3 font-semibold text-indigo-800">
            🔮 Potty insights
          </h2>
          <p className="text-xs text-indigo-700 mb-2">
            Based on {pottyInsights.sampleSize} toilet events in the last 7
            days. This is a heuristic, not veterinary advice.
          </p>
          <ul className="text-sm text-indigo-900 space-y-1">
            {pottyInsights.summary.map((insight, index) => (
              <li key={index}>• {insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Weight history */}
      <div className="mb-6 p-4 rounded-2xl bg-light-tan">
        <h2 className="mb-3 font-semibold">Weight history ⚖️</h2>

        <form onSubmit={handleLogWeight} className="mb-3 flex gap-2">
          <label htmlFor="new-weight" className="sr-only">
            New weight in kilograms
          </label>
          <input
            id="new-weight"
            type="number"
            min="0.1"
            step="0.1"
            inputMode="decimal"
            value={weightInput}
            onChange={(event) => setWeightInput(event.target.value)}
            placeholder="New weight (kg)"
            className="min-w-0 flex-1 rounded-xl border border-warm-brown/20 bg-white px-3 py-2 text-sm text-text-dark focus:outline-none focus:border-warm-brown"
          />
          <button
            type="submit"
            disabled={weightPending}
            className="shrink-0 rounded-xl bg-warm-brown px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {weightPending ? "Saving…" : "Log weight"}
          </button>
        </form>

        {weightError && (
          <p role="alert" className="mb-2 text-xs text-rose-700">
            {weightError}
          </p>
        )}

        {sortedWeights.length === 0 ? (
          <p className="text-sm text-text-muted">No weight entries yet.</p>
        ) : (
          <div className="space-y-1">
            {sortedWeights.map((weight) => (
              <div key={weight.id} className="flex justify-between text-sm">
                <span>{weight.weight} kg</span>
                <span>{getTimeAgo(weight.recordedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  {c.emoji} {EVENT_DISPLAY[event.type]?.label ?? event.type}
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
                {(props.isOwner || event.userId === props.userIdInDB) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingEventId(event.id)}
                      aria-label="Edit event"
                      className="text-xs font-medium text-warm-brown hover:opacity-70"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteEventId(event.id)}
                      aria-label="Delete event"
                      className="text-xs text-rose-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
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

      {confirmDeleteEventId && (
        <Modal
          title="Delete this event?"
          description="This action cannot be undone."
          onClose={() => setConfirmDeleteEventId(null)}
          size="sm"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  props.onDeleteEvent(confirmDeleteEventId);
                  setConfirmDeleteEventId(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteEventId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-warm-brown border border-warm-brown/20 hover:bg-light-tan transition-colors"
              >
                Cancel
              </button>
            </div>
          }
        >
          <p className="text-sm text-text-muted">
            This removes the care event from the household history.
          </p>
        </Modal>
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEventId(null)}
          onSaved={props.onSave}
        />
      )}
    </div>
  );
}
