import { useState } from "react";
import type { Dog } from "../types/core.ts";
import { supabase } from "../lib/supabase.ts";

type AddDogScreenProps = {
  onSubmitDog: (newDog: Dog) => void;
  userIdInDB: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  borderRadius: "0.875rem",
  border: "1.5px solid rgba(124, 92, 62, 0.2)",
  backgroundColor: "var(--cream)",
  color: "var(--text-dark)",
  fontSize: "0.9rem",
  fontFamily: "DM Sans, sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: "0.5rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

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
      const filePath = `${props.userIdInDB}/${crypto.randomUUID()}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("dog-images")
        .upload(filePath, newDogImageFile);

      console.log("Upload result:", uploadData);

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
    };

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
      setIsSubmitting(false);
      return;
    }

    props.onSubmitDog(newDog);
  }

  return (
    <div style={{ paddingTop: "1rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "0.25rem",
          }}
        >
          growing your pack
        </p>
        <h1
          style={{
            fontFamily: "Fraunces, serif",
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--warm-brown)",
            margin: 0,
          }}
        >
          Add a Dog
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Photo upload */}
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <label
            style={{
              display: "inline-block",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "1.5rem",
                border: "2px dashed rgba(124, 92, 62, 0.3)",
                backgroundColor: previewUrl
                  ? "transparent"
                  : "var(--light-tan)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 0.5rem",
                overflow: "hidden",
                transition: "border-color 0.15s ease",
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "2rem" }}>📷</span>
              )}
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                margin: 0,
              }}
            >
              {previewUrl ? "Change photo" : "Add a photo"}
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {/* Dog name */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={labelStyle}>Dog's name *</label>
          <input
            type="text"
            placeholder="e.g. Bear K"
            style={inputStyle}
            onChange={(e) => setNewDogName(e.target.value)}
          />
        </div>

        {/* Age and weight side by side */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div>
            <label style={labelStyle}>Age (years)</label>
            <input
              type="number"
              min="0"
              max="30"
              placeholder="e.g. 3"
              style={inputStyle}
              onChange={(e) =>
                setNewDogAge(e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div>
            <label style={labelStyle}>Weight (kg)</label>
            <input
              type="number"
              min="0"
              max="200"
              placeholder="e.g. 28"
              style={inputStyle}
              onChange={(e) =>
                setNewDogWeight(e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "0.875rem",
            borderRadius: "0.875rem",
            border: "none",
            backgroundColor: isSubmitting
              ? "rgba(124, 92, 62, 0.3)"
              : "var(--warm-brown)",
            color: "white",
            fontSize: "0.95rem",
            fontWeight: 600,
            fontFamily: "DM Sans, sans-serif",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            transition: "opacity 0.15s ease",
          }}
        >
          {isSubmitting ? "Adding..." : "Add to your pack 🐾"}
        </button>
      </form>
    </div>
  );
}
