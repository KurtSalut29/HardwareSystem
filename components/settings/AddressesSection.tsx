"use client";

import { useEffect, useState } from "react";
import { Home, MapPin, MapPinPlus, Pencil, Phone, StickyNote, Trash2, UserRound } from "lucide-react";
import SettingsCard from "@/components/settings/SettingsCard";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Alert from "@/components/ui/Alert";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import { useToast } from "@/components/ui/ToastProvider";
import { limitPhoneInput } from "@/lib/validation";

export type SavedAddress = {
  id: number; label: string; address: string; latitude: number; longitude: number;
  notes: string | null; recipientName: string | null; recipientContact: string | null;
};
type Home = { defaultAddress: string | null; defaultLat: number | null; defaultLng: number | null };

const FIELD = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

/**
 * Where the customer has things delivered: their home (from sign-up) and other
 * saved places, each with an optional landmark and the person who receives there.
 * Checkout offers all of them.
 */
export default function AddressesSection() {
  const showToast = useToast();
  const [home, setHome] = useState<Home | null>(null);
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | "new" | "home" | null>(null);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);

  async function load() {
    try {
      const [a, b] = await Promise.all([fetch("/api/account"), fetch("/api/account/addresses")]);
      if (!a.ok || !b.ok) { setLoadError(true); return; }
      setHome(await a.json()); setList(await b.json()); setLoadError(false);
    } catch { setLoadError(true); }
  }
  useEffect(() => {
    let live = true;
    Promise.all([fetch("/api/account"), fetch("/api/account/addresses")]).then(async ([a, b]) => {
      if (!live) return;
      if (!a.ok || !b.ok) { setLoadError(true); return; }
      setHome(await a.json()); setList(await b.json());
    }).catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, []);

  async function remove(a: SavedAddress) {
    const res = await fetch(`/api/account/addresses?id=${a.id}`, { method: "DELETE" });
    if (!res.ok) { showToast("Couldn't delete that address. Try again.", "error"); return; }
    setList((l) => (l ?? []).filter((x) => x.id !== a.id));
    setDeleting(null);
    showToast(`"${a.label}" deleted.`);
  }

  return (
    <>
      <SettingsCard title="Delivery addresses" icon={<MapPin className="size-5" />}
        description="Save the places you order to, like home, work, or a relative's house. At checkout, pick one and the driver gets the landmark and the receiver's number."
        footer={
          <div className="flex justify-end">
            <Button icon={<MapPinPlus className="size-4" />} onClick={() => setEditing("new")} disabled={!list}>Add an address</Button>
          </div>
        }>
        {loadError && <div className="py-3"><Alert tone="bad" compact action={<Button size="sm" variant="secondary" onClick={load}>Try again</Button>}>Couldn&apos;t load your addresses.</Alert></div>}
        {!list && !loadError && <div className="my-4 h-28 animate-pulse rounded-xl bg-recess" />}
        {list && (
          <ul className="divide-y divide-line">
            <li className="flex items-start gap-3 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white"><Home className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">Home <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-bold text-brand-ink">Default</span></p>
                <p className="text-[13px] text-ink-3">{home?.defaultAddress || <span className="text-warn">Not pinned yet — add it so checkout can use it.</span>}</p>
              </div>
              <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setEditing("home")}>Edit</Button>
            </li>
            {list.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><MapPin className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{a.label}</p>
                  <p className="text-[13px] text-ink-3">{a.address}</p>
                  {a.notes && <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-ink-3"><StickyNote className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> {a.notes}</p>}
                  {a.recipientName && (
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3"><UserRound className="size-3.5 text-ink-4" /> Receiver: {a.recipientName}
                      {a.recipientContact && <span className="num inline-flex items-center gap-1"> · <Phone className="size-3 text-ink-4" />{a.recipientContact}</span>}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                  <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(a)}>Edit</Button>
                  <Button size="sm" variant="danger-soft" icon={<Trash2 className="size-3.5" />} onClick={() => setDeleting(a)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {list && list.length === 0 && (
          <p className="pb-4 text-[12.5px] text-ink-4">Ordering for someone else, or to your workplace? Add it here so you don&apos;t have to pin it every time.</p>
        )}
      </SettingsCard>

      {editing && (
        <AddressModal
          target={editing}
          home={home}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); showToast(msg); void load(); }}
        />
      )}
      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => (deleting ? remove(deleting) : undefined)}
        title={`Delete "${deleting?.label}"?`} body="Orders already placed to this address aren't affected." confirmLabel="Delete address" />
    </>
  );
}

function AddressModal({ target, home, onClose, onSaved }: {
  target: SavedAddress | "new" | "home";
  home: Home | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isHome = target === "home";
  const existing = typeof target === "object" ? target : null;
  const [label, setLabel] = useState(existing?.label ?? "");
  const [loc, setLoc] = useState<PickedLocation | null>(
    existing ? { address: existing.address, lat: existing.latitude, lng: existing.longitude }
      : isHome && home?.defaultLat != null && home.defaultLng != null ? { address: home.defaultAddress ?? "", lat: home.defaultLat, lng: home.defaultLng } : null,
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [rName, setRName] = useState(existing?.recipientName ?? "");
  const [rContact, setRContact] = useState(existing?.recipientContact ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!isHome && !label.trim()) { setError("Give this address a name, e.g. Work or Nanay's house."); return; }
    if (!loc) { setError("Pin the location on the map."); return; }
    if (rContact && rContact.replace(/\D/g, "").length < 11) { setError("The receiver's number should be 11 digits starting with 09."); return; }
    setSaving(true);
    const res = isHome
      ? await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultAddress: loc.address, defaultLat: loc.lat, defaultLng: loc.lng }) })
      : await fetch("/api/account/addresses", {
          method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existing?.id, label, address: loc.address, latitude: loc.lat, longitude: loc.lng, notes, recipientName: rName, recipientContact: rContact }),
        });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Couldn't save the address. Try again."); return; }
    onSaved(isHome ? "Home address updated." : existing ? `"${label}" updated.` : `"${label}" saved. You can pick it at checkout.`);
  }

  return (
    <Modal open onClose={onClose} size="lg" icon={isHome ? <Home className="size-5" /> : <MapPinPlus className="size-5" />}
      title={isHome ? "Home address" : existing ? `Edit "${existing.label}"` : "Add an address"}
      description={isHome ? "Your usual drop-off point. Checkout picks it by default." : "A place you order to besides home."}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} loading={saving}>{isHome ? "Save home" : "Save address"}</Button>
        </div>
      }>
      <div className="space-y-4">
        {!isHome && (
          <div>
            <label htmlFor="addr-label" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Name this place</label>
            <input id="addr-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} className={FIELD} placeholder="e.g. Work, Nanay's house, Construction site" />
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Location</p>
          <LocationPicker value={loc} onChange={setLoc} />
        </div>
        {!isHome && (
          <>
            <div>
              <label htmlFor="addr-notes" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Exact spot or landmark <span className="font-normal text-ink-4">(optional)</span></label>
              <input id="addr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} className={FIELD} placeholder="e.g. Blue gate beside the sari-sari store, 2nd floor" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="addr-rname" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Who receives here <span className="font-normal text-ink-4">(optional)</span></label>
                <input id="addr-rname" value={rName} onChange={(e) => setRName(e.target.value)} maxLength={80} className={FIELD} placeholder="Receiver's name" />
              </div>
              <div>
                <label htmlFor="addr-rcontact" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Receiver&apos;s number</label>
                <input id="addr-rcontact" inputMode="numeric" value={rContact} onChange={(e) => setRContact(limitPhoneInput(e.target.value))} maxLength={13} className={`${FIELD} num`} placeholder="09171234567" />
              </div>
            </div>
            <Alert tone="info" compact>The driver calls the receiver&apos;s number when they arrive. Leave it blank if you&apos;ll receive it yourself.</Alert>
          </>
        )}
        {error && <Alert tone="bad" compact>{error}</Alert>}
      </div>
    </Modal>
  );
}
