"use client";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusMessage } from "@/components/StatusMessage";
import { FormField, inputClass, textareaClass } from "@/components/FormField";
import { createClient } from "@/lib/supabase/client";
import { downscaleToJpeg } from "@/lib/images";

// app/admin/testimonials/page.tsx
// Admin UI for student testimonials: create with photo upload, approve or
// unpublish, delete. Photos go browser -> Supabase Storage (site bucket,
// testimonials/<id>.jpg, admin-write only) then the public URL is stored on
// the row, same pattern as AvatarUploader and AboutPhotoUploader.
//
// Consent is a hard gate in the form: the create button stays disabled
// until the permission checkbox is ticked, mirroring the server-side
// z.literal(true) so the two can never disagree.
type Row = {
  id: string;
  quote: string;
  full_name: string;
  role: string;
  photo_url: string | null;
  consent: boolean;
  approved: boolean;
  sort_order: number;
  created_at: string;
};

const QUOTE_MAX = 300;
const PHOTO_PREFIX = "testimonials/";

export default function AdminTestimonialsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [quote, setQuote] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [consent, setConsent] = useState(false);
  const [approved, setApproved] = useState(true);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const res = await fetch("/api/admin/testimonials");
    if (res.status === 403) {
      setLoadError("Admin access required.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setLoadError("Couldn't load testimonials.");
      setLoading(false);
      return;
    }
    const { testimonials } = await res.json();
    setRows(testimonials ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePhoto(file: File) {
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    try {
      const blob = await downscaleToJpeg(file, 480);
      setPhotoBlob(blob);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image.");
    }
  }

  function resetForm() {
    setQuote("");
    setFullName("");
    setRole("");
    setConsent(false);
    setApproved(true);
    setPhotoBlob(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (quote.trim().length < 10) {
      setError("Quote needs at least 10 characters.");
      return;
    }
    if (!consent) {
      setError("Tick the permission checkbox before saving.");
      return;
    }
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      let photoUrl: string | null = null;
      if (photoBlob) {
        const path = PHOTO_PREFIX + id + ".jpg";
        const { error: uploadError } = await supabase.storage
          .from("site")
          .upload(path, photoBlob, { contentType: "image/jpeg", upsert: true });
        if (uploadError) throw uploadError;
        photoUrl = supabase.storage.from("site").getPublicUrl(path).data.publicUrl;
      }
      const res = await fetch("/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote: quote.trim(),
          full_name: fullName.trim(),
          role: role.trim(),
          photo_url: photoUrl,
          consent: true,
          approved,
          sort_order: rows.length,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save the testimonial.");
      }
      setNotice("Testimonial saved.");
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the testimonial.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleApproved(row: Row) {
    setError(null);
    const res = await fetch(`/api/admin/testimonials/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !row.approved }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't update publish state.");
      return;
    }
    await load();
  }

  async function doRemove(row: Row) {
    setError(null);
    const res = await fetch(`/api/admin/testimonials/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete the testimonial.");
      return;
    }
    if (row.photo_url) {
      await supabase.storage.from("site").remove([PHOTO_PREFIX + row.id + ".jpg"]).catch(() => {});
    }
    await load();
  }

  return (
    <div>
      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
          confirmLabel="Delete"
          tone="rose"
        />
      )}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-navy">Testimonials</h1>
        <p className="text-sm text-navy-light mt-1">
          Real student quotes with permission on record. Only consented and published rows appear
          on the landing page.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-hairline p-6 mb-8">
        <h2 className="font-display text-lg font-semibold text-navy mb-4">Add a testimonial</h2>
        <form onSubmit={handleSubmit}>
          <FormField
            label="Quote"
            hint="Their exact words, kept short. The landing page clamps to three lines."
          >
            <textarea
              className={textareaClass}
              value={quote}
              onChange={(e) => setQuote(e.target.value.slice(0, QUOTE_MAX))}
              placeholder="What did the student say, in their own words?"
            />
            <span className="block text-xs text-navy-light mt-1 text-right">
              {quote.length}/{QUOTE_MAX}
            </span>
          </FormField>
          <div className="grid md:grid-cols-2 gap-x-6">
            <FormField label="Full name">
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Adaeze Okonkwo"
              />
            </FormField>
            <FormField label="Role" hint="Level, course, and institution.">
              <input
                className={inputClass}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. 400 Level, Computer Science, University of Ibadan"
              />
            </FormField>
          </div>
          <FormField label="Photo" hint="JPG, PNG, or WebP. Downscaled in-browser before upload.">
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview of the student photo"
                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                />
              ) : (
                <span className="w-16 h-16 rounded-xl bg-navy-50 border border-hairline flex items-center justify-center text-xs text-navy-light shrink-0">
                  No photo
                </span>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-seal border border-hairline bg-white text-xs font-medium text-navy px-4 py-2 hover:bg-navy-50 transition-colors"
              >
                {photoPreview ? "Replace photo" : "Choose photo"}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhoto(f);
              }}
            />
          </FormField>
          <label className="flex items-start gap-2 text-sm font-medium text-ink mb-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="rounded border-hairline mt-0.5"
            />
            I have this student&apos;s written permission to publish their words and photo.
          </label>
          <label className="flex items-start gap-2 text-sm font-medium text-ink mb-4">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
              className="rounded border-hairline mt-0.5"
            />
            Publish now (visible on the landing page)
          </label>
          <StatusMessage tone="success">{notice}</StatusMessage>
          <StatusMessage tone="error">{error}</StatusMessage>
          <button
            type="submit"
            disabled={saving || !consent}
            className="rounded-seal bg-navy text-white text-sm font-medium px-6 py-2.5 hover:bg-navy-light transition-colors disabled:opacity-60"
          >
            {saving ? "Saving\u2026" : "Save testimonial"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline">
          <h2 className="font-display text-lg font-semibold text-navy">Existing testimonials</h2>
        </div>
        {loading ? (
          <p className="text-sm text-navy-light p-5">Loading&hellip;</p>
        ) : loadError ? (
          <p className="text-sm text-rose p-5">{loadError}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-navy-light p-5">
            No testimonials yet. Add the first one above; the landing section appears once one row
            is consented and published.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((row) => (
              <li key={row.id} className="p-5 flex items-start gap-4">
                {row.photo_url ? (
                  <img
                    src={row.photo_url}
                    alt={row.full_name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <span className="w-14 h-14 rounded-xl bg-navy-50 border border-hairline flex items-center justify-center text-xs text-navy-light shrink-0">
                    No photo
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink line-clamp-2">&ldquo;{row.quote}&rdquo;</p>
                  <p className="text-xs text-navy-light mt-1">
                    <span className="font-medium text-navy">{row.full_name}</span>, {row.role}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span
                      className={
                        "text-xs font-medium px-2 py-1 rounded-full " +
                        (row.approved ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber")
                      }
                    >
                      {row.approved ? "Published" : "Draft"}
                    </span>
                    <span
                      className={
                        "text-xs font-medium px-2 py-1 rounded-full " +
                        (row.consent ? "bg-navy-50 text-navy-light" : "bg-rose-light text-rose")
                      }
                    >
                      {row.consent ? "Consent on record" : "No consent"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleApproved(row)}
                    className="text-xs font-medium text-navy hover:underline"
                  >
                    {row.approved ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({
                        message: `Delete ${row.full_name}'s testimonial? This also removes their photo.`,
                        onConfirm: () => doRemove(row),
                      })
                    }
                    className="text-xs font-medium text-rose hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
