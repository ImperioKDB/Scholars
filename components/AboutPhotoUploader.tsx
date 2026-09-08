"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { downscaleToJpeg } from "@/lib/images";
import { StatusMessage } from "@/components/StatusMessage";

// components/AboutPhotoUploader.tsx
//
// Admin-only control (rendered by app/about/page.tsx only when the viewer's
// profile has is_admin) for the About page founder portrait. Writes to the
// public 'site' bucket (migration 0013) at the fixed path
// 'about-portrait.jpg': RLS allows insert/update/delete there only for
// is_admin(auth.uid()), and public read lets every visitor fetch it.
//
// Upsert semantics: Upload replaces whatever is there, so there is no
// separate "edit" step. Remove deletes the object; the page falls back to
// its placeholder. router.refresh() re-runs the server page so the new
// object's updated_at (used as the cache-buster) is picked up immediately.
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const OUTPUT_SIZE = 640;
const OBJECT_NAME = "about-portrait.jpg";

export function AboutPhotoUploader({ currentUrl }: { currentUrl: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setNotice(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Keep it under 5MB.");
      return;
    }
    setBusy(true);
    try {
      const blob = await downscaleToJpeg(file, OUTPUT_SIZE);
      const { error: uploadError } = await supabase.storage
        .from("site")
        .upload(OBJECT_NAME, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      setNotice("Portrait saved to the About page.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: removeError } = await supabase.storage.from("site").remove([OBJECT_NAME]);
      if (removeError) throw removeError;
      setNotice("Portrait removed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-seal border border-hairline bg-white text-xs font-medium text-navy px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
        >
          {busy ? "Saving\u2026" : currentUrl ? "Replace photo" : "Upload photo"}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="text-xs font-medium text-rose hover:underline disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
      <StatusMessage tone="success">{notice}</StatusMessage>
      <StatusMessage tone="error">{error}</StatusMessage>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
