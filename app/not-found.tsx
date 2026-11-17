import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard, SearchX } from "lucide-react";
import { STORE_NAME } from "@/lib/brand";

/** Shown for any address that has no page, with a way back instead of a dead end. */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[24px] border border-line bg-surface px-6 pb-6 pt-8 text-center shadow-[0_18px_40px_-24px_rgba(16,24,64,0.35)]">
        <Image src="/logo.png" alt="" width={64} height={64} className="mx-auto size-16 object-contain" />
        <p className="mt-2 font-display text-[18px] font-extrabold text-ink">{STORE_NAME}</p>

        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-bold text-brand-ink">
          <SearchX className="size-3.5" /> Error 404
        </span>
        <h1 className="mt-3 font-display text-[22px] font-extrabold text-ink">This page doesn&apos;t exist</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">
          The address may be mistyped, or the page has moved. Go back to your dashboard to continue.
        </p>

        <div className="mt-6 grid gap-2">
          <Link href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_rgba(30,79,216,0.9)] transition hover:brightness-110">
            <LayoutDashboard className="size-4" /> Go to my dashboard
          </Link>
          <Link href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[14px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink">
            <ArrowLeft className="size-4" /> Home page
          </Link>
        </div>
      </div>
    </main>
  );
}
