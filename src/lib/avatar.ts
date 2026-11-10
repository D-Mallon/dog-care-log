import { supabase } from "./supabase.ts";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function uploadAvatar(
  file: File,
  userId: string,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  const path = `${userId}/${crypto.randomUUID()}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: data.publicUrl },
  });
  if (updateError) throw updateError;

  return data.publicUrl;
}
