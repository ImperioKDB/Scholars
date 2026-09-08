"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusMessage } from "@/components/StatusMessage";

// components/AvatarUploader.tsx
//
// Profile photo upload for the Settings page. The image bytes go straight
// from the browser to Supabase Storage (storage RLS from migration 0010
// scopes writes to avatars/<user_id>/, so a user can only overwrite their
// own object); this component then records the resulting public URL on the
// profile via POST /api/profile. The sidebar reads that URL and shows the
// photo instead of the initials avatar.
//
// SAVE FEEDBACK (live feedback): the upload always persisted, but there was
// no visible confirmation and the server-rendered sidebar avatar didn't
// update until you navigated away. Now a successful upload/remove calls
// router.refresh() (re-renders the server layout in place, so the photo
// appears next to your name across the app immediately) and shows a green
// confirmation line. router.refresh() preserves client state, so nothing
// here resets.
//
// AUDIT FIX (batch 3): the confirmation and error lines are wrapped in
// StatusMessage (role="status" aria-live="polite") so screen reader users
// hear the outcome instead of only seeing it.
//
// The file is downscaled to a 256px square JPEG in the browser before
// upload, so uploads stay small (~10-30KB), consistent, and within the
// bucket's 2MB limit even when the source photo is huge.
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const OUTPUT_SIZE = 256;

function downscaleToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Center-crop to a square, then scale down.
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode the image"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image"));
    };
    img.src = url;
  });
}

export function AvatarUploader({ initialUrl }: { initialUrl: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
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
      setError("Keep it under 2MB.");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const blob = await downscaleToJpeg(file);
      const path = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust query so a re-upload doesn't show the stale image.
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      if (!res.ok) throw new Error("Couldn't save the photo to your profile");
      setUrl(publicUrl);
      setNotice("Photo saved. It now shows next to your name across Scholars.");
      // Re-render the server layout (sidebar) in place so the new photo
      // appears across the app without leaving this page.
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Ignore removal errors (object may not exist); the profile
        // update below is what actually clears the avatar everywhere.
        await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);
      }
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      });
      if (!res.ok) throw new Error("Couldn't update your profile");
      setUrl(null);
      setNotice("Photo removed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {url ? (
        <img src={url} alt="Your profile" className="w-16 h-16 rounded-full object-cover shrink-0" />
      ) : (
        <span className="w-16 h-16 rounded-full bg-navy-50 border border-hairline flex items-center justify-center text-xs text-navy-light shrink-0">
          No photo
        </span>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-seal bg-navy text-white text-xs font-medium px-4 py-2 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {busy ? "Uploading\u2026" : url ? "Change photo" : "Upload photo"}
          </button>
          {url && (
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
      </div>
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
