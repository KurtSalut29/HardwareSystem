"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search, Package, MapPin, Truck, Store, Wallet, ShieldCheck,
  ArrowRight, PackageSearch, HardHat, Ruler, LogIn,
} from "lucide-react";
import { STORE_NAME } from "@/lib/brand";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Category = { id: number; name: string; description: string | null };
type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  image: string | null;
  description: string | null;
  subcategory: string | null;
  categoryId: number;
  category: { id: number; name: string };
  inStock: boolean;
};

// Every "order this" path funnels through sign-in and comes back to the shop.
const ORDER_HREF = "/login?next=/shop";

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/storefront")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setProducts(d.products ?? []);
        setCategories(d.categories ?? []);
        setStoreName(d.storeName ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayName = storeName ?? STORE_NAME;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = activeCat === "all" || p.categoryId === activeCat;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.subcategory ?? "").toLowerCase().includes(q) ||
        p.category.name.toLowerCase().includes(q)
      );
    });
  }, [products, search, activeCat]);

  // Only offer a category chip if something in the catalogue actually sits under it.
  const usedCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.categoryId === c.id)),
    [categories, products],
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <SiteHeader displayName={displayName} />
      <Hero displayName={displayName} productCount={products.length} categoryCount={usedCategories.length} />
      <StripeBand />

      <section id="products" className="scroll-mt-20 max-w-6xl mx-auto px-5 py-14 sm:py-16">
        <SectionHeading
          index="01"
          title="What we carry"
          blurb="Live from the store's shelves. Prices are per unit and update as stock moves."
        />

        <div className="mt-7 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search size={ICON_SIZE.md} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cement, nails, plywood, paint..."
              className="w-full pl-11 pr-4 py-3 text-sm bg-white border rounded-xl transition focus:outline-none focus:ring-4"
              style={{ borderColor: "var(--border-strong)", ["--tw-ring-color" as string]: "var(--brand-soft)" }}
            />
          </div>
          <p className="text-xs font-semibold shrink-0 num" style={{ color: "var(--text-muted)" }}>
            {filtered.length} of {products.length} items
          </p>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
          <CategoryChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
            All products
          </CategoryChip>
          {usedCategories.map((c) => (
            <CategoryChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </CategoryChip>
          ))}
        </div>

        <div className="mt-7">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 rounded-2xl bg-white border animate-pulse" style={{ borderColor: "var(--border)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border py-16 text-center" style={{ borderColor: "var(--border)" }}>
              <PackageSearch size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                {products.length === 0 ? "The catalogue is being set up." : "Nothing matches that search."}
              </p>
              {products.length > 0 && (
                <button
                  onClick={() => { setSearch(""); setActiveCat("all"); }}
                  className="mt-3 text-xs font-bold hover:underline"
                  style={{ color: "var(--brand)" }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      <HowItWorks />
      <SiteFooter displayName={displayName} />
    </div>
  );
}

function SiteHeader({ displayName }: { displayName: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 transition-shadow"
      style={{
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${scrolled ? "var(--border-strong)" : "var(--border)"}`,
        boxShadow: scrolled ? "0 1px 12px rgba(16,24,64,0.06)" : "none",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo.png" alt={displayName} width={40} height={40} className="object-contain" priority />
          <span className="font-display font-extrabold text-base tracking-tight" style={{ color: "var(--text-primary)" }}>
            {displayName}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-6 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          <a href="#products" className="hover:text-[color:var(--brand)] transition">Products</a>
          <a href="#how" className="hover:text-[color:var(--brand)] transition">How to order</a>
          <a href="#visit" className="hover:text-[color:var(--brand)] transition">Visit us</a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold transition hover:bg-[color:var(--bg-muted)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <LogIn size={ICON_SIZE.sm} /> Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:brightness-95 active:scale-[0.98]"
            style={{ background: "var(--brand)" }}
          >
            Create account
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ displayName, productCount, categoryCount }: { displayName: string; productCount: number; categoryCount: number }) {
  return (
    <section className="relative overflow-hidden" style={{ background: "var(--hero-bg)" }}>
      <div className="absolute inset-0 blueprint-grid" />
      <div
        className="absolute w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 65%)", opacity: 0.18, top: "-200px", right: "-160px" }}
      />

      <div className="relative max-w-6xl mx-auto px-5 py-16 sm:py-20 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
        <div>
          {/* Dimension-line marker — an engineering-drawing cue rather than a generic pill */}
          <div className="flex items-center gap-2.5 mb-6">
            <span className="h-px w-8" style={{ background: "var(--brand)" }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--brand)" }}>
              Naval, Biliran
            </span>
          </div>

          <h1
            className="font-display font-extrabold leading-[1.05] text-4xl sm:text-5xl lg:text-[3.4rem] tracking-tight"
            style={{ color: "var(--hero-ink)" }}
          >
            Hardware for the
            <br />
            whole build.
          </h1>

          <p className="mt-5 text-base leading-relaxed max-w-lg" style={{ color: "var(--hero-ink-dim)" }}>
            Browse everything {displayName} has on the shelf — cement, steel, tools, finishing.
            Check prices before you leave the site. Create an account when you&apos;re ready to order,
            and we&apos;ll deliver it or hold it for pickup.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#products"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
              style={{ background: "var(--brand)" }}
            >
              Browse products <ArrowRight size={ICON_SIZE.sm} />
            </a>
            <Link
              href={ORDER_HREF}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.22)", color: "var(--hero-ink)" }}
            >
              Sign in to order
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <HeroStat icon={<Package size={15} />} value={productCount > 0 ? String(productCount) : "—"} label="Items listed" />
            <HeroStat icon={<Ruler size={15} />} value={categoryCount > 0 ? String(categoryCount) : "—"} label="Categories" />
            <HeroStat icon={<Truck size={15} />} value="Delivery" label="or store pickup" />
          </div>
        </div>

        {/* Spec sheet — the store's own details, framed like a drawing title block */}
        <div
          className="rounded-2xl border p-6 backdrop-blur-sm"
          style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" }}
        >
          <div className="flex items-center gap-2 pb-4 mb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <HardHat size={ICON_SIZE.md} style={{ color: "var(--brand)" }} />
            <p className="font-display text-sm font-extrabold uppercase tracking-wider" style={{ color: "var(--hero-ink)" }}>
              Store details
            </p>
          </div>
          <dl className="space-y-4">
            <SpecRow icon={<MapPin size={14} />} label="Where" value="Naval, Biliran" />
            <SpecRow icon={<Truck size={14} />} label="Delivery" value="Booked to your pinned location" />
            <SpecRow icon={<Store size={14} />} label="Pickup" value="Reserve online, collect in store" />
            <SpecRow icon={<Wallet size={14} />} label="Payment" value="Cash or GCash" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--hero-chip-bg)", color: "var(--brand)" }}
      >
        {icon}
      </div>
      <div>
        <p className="font-display text-sm font-extrabold num leading-tight" style={{ color: "var(--hero-ink)" }}>{value}</p>
        <p className="text-[11px]" style={{ color: "var(--hero-ink-dim)" }}>{label}</p>
      </div>
    </div>
  );
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0" style={{ color: "var(--hero-ink-dim)" }}>{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--hero-ink-dim)" }}>{label}</dt>
        <dd className="text-sm font-semibold" style={{ color: "var(--hero-ink)" }}>{value}</dd>
      </div>
    </div>
  );
}

// Diagonal caution-stripe band — the construction cue, rendered in the brand
// blue/gray instead of the usual hazard yellow so it stays inside the palette.
function StripeBand() {
  return (
    <div
      className="h-3"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, var(--brand) 0px, var(--brand) 14px, transparent 14px, transparent 28px)",
        backgroundColor: "var(--brand-soft)",
      }}
    />
  );
}

function SectionHeading({ index, title, blurb }: { index: string; title: string; blurb: string }) {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display text-xs font-extrabold num tracking-widest" style={{ color: "var(--brand)" }}>{index}</span>
        <span className="h-px flex-1 max-w-[40px]" style={{ background: "var(--border-strong)" }} />
      </div>
      <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{blurb}</p>
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-bold border transition"
      style={
        active
          ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }
          : { background: "var(--bg-card)", borderColor: "var(--border-strong)", color: "var(--text-secondary)" }
      }
    >
      {children}
    </button>
  );
}

function ProductCard({ product: p }: { product: Product }) {
  return (
    <div
      className="group bg-white rounded-2xl border flex flex-col overflow-hidden transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,24,64,0.08)]"
      style={{ borderColor: "var(--border-strong)" }}
    >
      <div className="relative aspect-[4/3] bg-[color:var(--bg-muted)] overflow-hidden">
        {p.image ? (
          <Image
            src={p.image}
            alt={p.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-xl"
              style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        {!p.inStock && (
          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/95 shadow-sm" style={{ color: "var(--bad)" }}>
            Out of stock
          </span>
        )}
      </div>

      <div className="p-3.5 flex flex-col flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: "var(--brand)" }}>
          {p.subcategory || p.category.name}
        </p>
        <p className="mt-1 text-sm font-bold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
          {p.name}
        </p>

        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-lg font-extrabold num" style={{ color: "var(--text-primary)" }}>
              ₱{p.price.toFixed(2)}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>/ {p.unit}</span>
          </div>
          {/* Colours are set with classes, not an inline style: an inline `color`
              would outrank the `hover:text-white` class and leave blue text on a
              blue fill on hover. */}
          <Link
            href={ORDER_HREF}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-colors border-[color:var(--brand)] text-[color:var(--brand)] hover:bg-[color:var(--brand)] hover:text-white"
          >
            Order this <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: PackageSearch, title: "Browse the shelf", body: "Everything above is what the store actually stocks, at the price you'll pay. No account needed to look." },
    { icon: ShieldCheck, title: "Create your account", body: "Sign up as a customer in under a minute. It only asks for a username, a contact number and a password." },
    { icon: Truck, title: "Order and track", body: "Pin your delivery spot or choose pickup, pay cash or GCash, then follow your driver on the map until it arrives." },
  ];

  return (
    <section id="how" className="scroll-mt-20 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="max-w-6xl mx-auto px-5 py-14 sm:py-16">
        <SectionHeading index="02" title="How ordering works" blurb="Three steps from browsing to a delivery on its way." />
        <div className="mt-8 grid sm:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border p-5" style={{ borderColor: "var(--border-strong)", background: "var(--bg-subtle)" }}>
              <span className="font-display text-[11px] font-extrabold num tracking-widest" style={{ color: "var(--text-faint)" }}>
                STEP {String(i + 1).padStart(2, "0")}
              </span>
              <div
                className="mt-3 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
              >
                <s.icon size={ICON_SIZE.md} />
              </div>
              <p className="mt-3 font-display text-base font-extrabold" style={{ color: "var(--text-primary)" }}>{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:brightness-95 active:scale-[0.98]"
            style={{ background: "var(--brand)" }}
          >
            Create a customer account <ArrowRight size={ICON_SIZE.sm} />
          </Link>
          <Link href="/login" className="text-sm font-bold hover:underline" style={{ color: "var(--brand)" }}>
            I already have one
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ displayName }: { displayName: string }) {
  return (
    <footer id="visit" className="scroll-mt-20 relative overflow-hidden" style={{ background: "var(--hero-bg)" }}>
      <div className="absolute inset-0 blueprint-grid opacity-60" />
      <div className="relative max-w-6xl mx-auto px-5 py-12 grid sm:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt={displayName} width={40} height={40} className="object-contain" />
            <span className="font-display font-extrabold text-base" style={{ color: "var(--hero-ink)" }}>{displayName}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed max-w-sm" style={{ color: "var(--hero-ink-dim)" }}>
            Building materials and hardware supply in Naval, Biliran. Order online for delivery or store pickup.
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--hero-ink-dim)" }}>Staff access</p>
          <Link href="/login" className="mt-1.5 inline-block text-sm font-bold hover:underline" style={{ color: "var(--brand)" }}>
            Sign in to the management system
          </Link>
          <p className="mt-6 text-xs" style={{ color: "var(--hero-ink-dim)" }}>
            © {new Date().getFullYear()} {displayName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
