"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search, Package, MapPin, Truck, Store, Wallet, ArrowRight, ArrowUpRight, PackageSearch,
  Ruler, LogIn, Menu, X, BrickWall, Zap, Bolt, Wrench, Drill, Hammer, PaintRoller,
  Paintbrush, Droplets, HardHat, Axe, Cog, Navigation, Tag, type LucideIcon, type LucideProps,
} from "lucide-react";
import { STORE_NAME } from "@/lib/brand";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import StoreMap from "@/components/landing/StoreMap";

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
type CategoryWithCount = Category & { count: number };

// Every "order this" path funnels through sign-in and comes back to the shop.
const ORDER_HREF = "/login?next=/shop";
const SIGNUP_HREF = "/login?mode=signup";
const PAGE_SIZE = 8;
const FEATURED_CATEGORIES = 7;

// Category names are typed in by the admin, so match on keywords rather than exact names.
const CATEGORY_ICONS: [string, LucideIcon][] = [
  ["power tool", Drill],
  ["hand tool", Wrench],
  ["construct", BrickWall],
  ["electric", Zap],
  ["fasten", Bolt],
  ["measur", Ruler],
  ["finish", PaintRoller],
  ["paint", Paintbrush],
  ["plumb", Droplets],
  ["safety", HardHat],
  ["wood", Axe],
  ["carpent", Axe],
  ["accessor", Cog],
  ["tool", Hammer],
];

function iconFor(categoryName: string): LucideIcon {
  const name = categoryName.toLowerCase();
  return CATEGORY_ICONS.find(([key]) => name.includes(key))?.[1] ?? Package;
}

// Renders the aisle icon for a category. A component (rather than a variable holding one)
// so the icon is never treated as a component created during render.
function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  return createElement(iconFor(name), props);
}

function peso(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function scrollToId(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

// Fades its content up the first time it scrolls into view. Paired with `.reveal` in
// globals.css, which also switches the effect off for visitors who prefer reduced motion.
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setShown(true); io.disconnect(); }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-shown={shown} className={`reveal ${className}`} style={{ transitionDelay: shown ? `${delay}ms` : undefined }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<number | "all">("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
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

  // Only categories that actually have something on the shelf, alphabetically for the chips.
  const usedCategories = useMemo<CategoryWithCount[]>(() => {
    const counts = new Map<number, number>();
    for (const p of products) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    return categories
      .filter((c) => counts.has(c.id))
      .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
  }, [categories, products]);

  const largestCategories = useMemo(
    () => [...usedCategories].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [usedCategories],
  );

  // One in-stock item from each of the biggest categories, for the hero's shelf card.
  const shelfPicks = useMemo(() => {
    const picks: Product[] = [];
    for (const c of largestCategories) {
      const p = products.find((x) => x.categoryId === c.id && x.inStock);
      if (p) picks.push(p);
      if (picks.length === 4) break;
    }
    return picks;
  }, [largestCategories, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== "all" && p.categoryId !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.subcategory ?? "").toLowerCase().includes(q) ||
        p.category.name.toLowerCase().includes(q)
      );
    });
  }, [products, search, activeCat]);

  // Any change to what is being looked at starts the list again from the first page.
  function changeSearch(q: string) {
    setSearch(q);
    setVisible(PAGE_SIZE);
  }
  function changeCategory(id: number | "all") {
    setActiveCat(id);
    setVisible(PAGE_SIZE);
  }
  function pickCategory(id: number | "all") {
    changeCategory(id);
    setSearch("");
    scrollToId("products");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <SiteHeader displayName={displayName} />
      <Hero
        displayName={displayName}
        productCount={products.length}
        categoryCount={usedCategories.length}
        shelf={shelfPicks}
        loading={loading}
      />
      <ServiceStrip />
      <CategoryShowcase
        loading={loading}
        categories={largestCategories.slice(0, FEATURED_CATEGORIES)}
        productCount={products.length}
        categoryCount={usedCategories.length}
        onPick={pickCategory}
      />
      <CatalogueSection
        loading={loading}
        products={products}
        filtered={filtered}
        categories={usedCategories}
        activeCat={activeCat}
        search={search}
        visible={visible}
        onSearch={changeSearch}
        onCategory={changeCategory}
        onShowMore={() => setVisible((v) => v + PAGE_SIZE)}
        onClear={() => { changeSearch(""); changeCategory("all"); }}
      />
      <HowItWorks />
      <VisitUs displayName={displayName} />
      <SiteFooter displayName={displayName} />
    </div>
  );
}

/* ───────────────────────────── Header ───────────────────────────── */

const NAV_LINKS = [
  { id: "categories", label: "Categories" },
  { id: "products", label: "Products" },
  { id: "how", label: "How to order" },
  { id: "visit", label: "Visit us" },
] as const;

type SectionId = (typeof NAV_LINKS)[number]["id"];

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-card)]";
const FOCUS_RING_LIGHT = FOCUS_RING;

// The storefront is always shown in light mode (see ThemeProvider), so the header can use
// the ordinary light tokens.
function SiteHeader({ displayName }: { displayName: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<SectionId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const linkRefs = useRef<Partial<Record<SectionId, HTMLAnchorElement | null>>>({});
  const progressRef = useRef<HTMLSpanElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Slide the blue pill under whichever link is active. Positioned on the element directly
  // (not through state) so it can follow resizes and late-loading fonts without re-rendering.
  useEffect(() => {
    const place = () => {
      const pill = indicatorRef.current;
      if (!pill) return;
      const link = active ? linkRefs.current[active] : null;
      if (!link) { pill.style.opacity = "0"; return; }
      pill.style.opacity = "1";
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.transform = `translateX(${link.offsetLeft}px)`;
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [active]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      // The section whose top has passed the upper half of the screen is the one being read.
      // The last section is short, so reaching the bottom of the page counts as "Visit us".
      const line = window.innerHeight * 0.45;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: SectionId | null = null;
      for (const { id } of NAV_LINKS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(atBottom ? "visit" : current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    // A floating glass bar: fixed above the page, inset from the edges, with the hero photo
    // blurred through it. The glass thickens once the page scrolls so text stays readable over content.
    <header className="fixed inset-x-0 top-0 z-40 px-3 sm:px-5 pt-3 pointer-events-none">
      <div
        className="pointer-events-auto max-w-6xl mx-auto rounded-2xl border transition-[background-color,box-shadow] duration-300"
        style={{
          // A sheen from top-left plus a thin dark outline, so the glass edge reads on light backgrounds too.
          background: scrolled
            ? "linear-gradient(135deg, rgba(255,255,255,0.78), rgba(255,255,255,0.58))"
            : "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.22))",
          backdropFilter: "blur(22px) saturate(185%)",
          WebkitBackdropFilter: "blur(22px) saturate(185%)",
          borderColor: "rgba(255,255,255,0.7)",
          boxShadow: [
            "0 0 0 1px rgba(16,24,64,0.07)",
            "inset 0 1px 0 rgba(255,255,255,0.9)",
            "inset 0 -1px 0 rgba(255,255,255,0.25)",
            scrolled ? "0 18px 44px -20px rgba(16,24,64,0.45)" : "0 14px 36px -20px rgba(16,24,64,0.4)",
          ].join(", "),
        }}
      >
      <div className="relative px-3 sm:px-4 h-16 flex items-center gap-4">
        {/* How far down the page the visitor is. */}
        <span aria-hidden className="absolute left-4 right-4 bottom-0 h-[2px] rounded-full overflow-hidden">
          <span
            ref={progressRef}
            className="block h-full w-full origin-left"
            style={{ transform: "scaleX(0)", background: "linear-gradient(90deg, var(--brand), var(--info))" }}
          />
        </span>
        <Link href="/" className={`flex items-center gap-3 shrink-0 rounded-lg ${FOCUS_RING}`}>
          <Image src="/logo.png" alt="" width={38} height={38} className="object-contain" priority />
          <span className="flex flex-col leading-none">
            <span className="font-display font-extrabold text-[15px] tracking-tight" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              Hardware · Building supply
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="relative hidden lg:flex mx-auto items-center gap-1 rounded-full p-1"
          style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.6)" }}
        >
          <span
            ref={indicatorRef}
            aria-hidden
            className="nav-indicator absolute left-0 top-1 bottom-1 rounded-full opacity-0"
            style={{ background: "var(--brand)", boxShadow: "0 8px 18px -8px rgba(30,79,216,0.75)" }}
          />
          {NAV_LINKS.map(({ id, label }) => {
            const isActive = active === id;
            return (
              <a
                key={id}
                ref={(el) => { linkRefs.current[id] = el; }}
                href={`#${id}`}
                aria-current={isActive ? "location" : undefined}
                className={`relative z-[1] inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-300 ${FOCUS_RING} ${
                  isActive
                    ? "text-white"
                    : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[rgba(255,255,255,0.6)]"
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto lg:ml-0 flex items-center gap-1.5">
          <Link
            href="/login"
            className={`hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)] ${FOCUS_RING}`}
          >
            <LogIn size={ICON_SIZE.sm} /> Sign in
          </Link>
          <Link
            href={SIGNUP_HREF}
            className={`group hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98] ${FOCUS_RING}`}
            style={{ background: "var(--brand)" }}
          >
            Create account <ArrowRight size={ICON_SIZE.sm} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className={`lg:hidden inline-flex w-10 h-10 items-center justify-center rounded-lg transition-colors text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)] ${FOCUS_RING}`}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="site-menu" className="lg:hidden animate-menu-in" style={{ borderTop: "1px solid rgba(16,24,64,0.08)" }}>
          <nav aria-label="Main" className="px-3 pt-2 pb-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ id, label }) => {
              const isActive = active === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive ? "location" : undefined}
                  className={`flex items-center justify-between px-3 py-3 rounded-xl text-[15px] font-semibold transition-colors ${FOCUS_RING} ${
                    isActive
                      ? "bg-[color:var(--brand)] text-white"
                      : "text-[color:var(--text-secondary)] hover:bg-[rgba(255,255,255,0.6)]"
                  }`}
                >
                  {label}
                  {isActive && <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">You&apos;re here</span>}
                </a>
              );
            })}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold border border-[color:var(--border-strong)] text-[color:var(--text-primary)] ${FOCUS_RING}`}
              >
                <LogIn size={ICON_SIZE.sm} /> Sign in
              </Link>
              <Link
                href={SIGNUP_HREF}
                className={`inline-flex items-center justify-center py-2.5 rounded-lg text-sm font-bold text-white ${FOCUS_RING}`}
                style={{ background: "var(--brand)" }}
              >
                Create account
              </Link>
            </div>
          </nav>
        </div>
      )}
      </div>
    </header>
  );
}

/* ───────────────────────────── Hero ───────────────────────────── */

const HERO_TOP_MASK: React.CSSProperties = {
  maskImage: "linear-gradient(180deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.35) 70px, #000 170px)",
  WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.35) 70px, #000 170px)",
};

function Hero({
  displayName, productCount, categoryCount, shelf, loading,
}: { displayName: string; productCount: number; categoryCount: number; shelf: Product[]; loading: boolean }) {
  return (
    <section className="relative overflow-hidden" style={{ background: "var(--bg-card)" }}>
      {/* A real tool wall, faded to white behind the text so the copy stays readable. */}
      <Image src="/images/hero-tool-wall.jpg" alt="" fill priority quality={90} sizes="100vw" className="object-cover object-center animate-ken-burns" />
      {/* The white wash is masked off along the top edge, so the photo shows through the
          floating glass navbar instead of the bar sitting on plain white. */}
      <div aria-hidden className="absolute inset-0 lg:hidden" style={{ background: "rgba(255,255,255,0.9)", ...HERO_TOP_MASK }} />
      <div
        aria-hidden
        className="absolute inset-0 hidden lg:block"
        style={{
          background: "linear-gradient(90deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.94) 42%, rgba(255,255,255,0.55) 66%, rgba(255,255,255,0.12) 100%)",
          ...HERO_TOP_MASK,
        }}
      />

      <div className="relative max-w-6xl mx-auto px-5 pt-32 pb-16 sm:pt-36 sm:pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div>
          <div className="flex items-center gap-2.5 mb-6 animate-rise-in">
            <span className="h-px w-8" style={{ background: "var(--brand)" }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--brand)" }}>
              Naval, Biliran
            </span>
          </div>

          <h1
            className="font-display font-extrabold leading-[1.03] text-[2.6rem] sm:text-6xl lg:text-[4rem] tracking-tight animate-rise-in"
            style={{ color: "var(--text-primary)", animationDelay: "90ms" }}
          >
            Hardware for the
            <br />
            <span className="relative inline-block">
              whole build.
              <span
                aria-hidden
                className="absolute left-0 right-[0.4em] -bottom-1 h-[0.11em] rounded-full animate-draw-line"
                style={{ background: "linear-gradient(90deg, var(--brand), var(--info))", animationDelay: "750ms" }}
              />
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-md animate-rise-in" style={{ color: "var(--text-secondary)", animationDelay: "180ms" }}>
            See what&apos;s on {displayName}&apos;s shelf and what it costs today. Order online, then have it
            delivered or pick it up at the store.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 animate-rise-in" style={{ animationDelay: "270ms" }}>
            <a
              href="#categories"
              className={`group inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:brightness-110 hover:shadow-[0_10px_24px_-10px_rgba(30,79,216,0.7)] active:scale-[0.98] ${FOCUS_RING}`}
              style={{ background: "var(--brand)" }}
            >
              Browse the shelf <ArrowRight size={ICON_SIZE.sm} className="transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <Link
              href={ORDER_HREF}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-colors hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] ${FOCUS_RING}`}
              style={{ borderColor: "var(--border-strong)", color: "var(--text-primary)", background: "var(--bg-card)" }}
            >
              Sign in to order
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-3 max-w-md border-t pt-5 animate-rise-in" style={{ borderColor: "var(--border-strong)", animationDelay: "360ms" }}>
            <HeroStat value={productCount > 0 ? String(productCount) : "—"} label="Items listed" />
            <HeroStat value={categoryCount > 0 ? String(categoryCount) : "—"} label="Categories" />
            <HeroStat value="2 ways" label="Delivery or pickup" />
          </dl>
        </div>

        <div className="animate-slide-in-right" style={{ animationDelay: "220ms" }}>
          <ShelfCard items={shelf} loading={loading} productCount={productCount} />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    // Label first in the markup (dt before dd), value first on screen.
    <div className="flex flex-col-reverse">
      <dt className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="font-display text-2xl font-extrabold num leading-none" style={{ color: "var(--text-primary)" }}>{value}</dd>
    </div>
  );
}

// A live price card: real items from the biggest aisles, at today's prices.
function ShelfCard({ items, loading, productCount }: { items: Product[]; loading: boolean; productCount: number }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-[0_28px_60px_-30px_rgba(16,24,64,0.5)]"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <p className="font-display text-sm font-extrabold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          On the shelf today
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full animate-live-ping" style={{ background: "var(--good)" }} />
            <span className="relative w-2 h-2 rounded-full" style={{ background: "var(--good)" }} />
          </span>
          Live prices
        </span>
      </div>

      <ul>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="px-6 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div className="h-4 w-2/3 rounded animate-pulse" style={{ background: "var(--bg-muted)" }} />
              </li>
            ))
          : items.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-4 px-6 py-3.5 border-b last:border-b-0 transition-colors hover:bg-[color:var(--bg-subtle)] animate-rise-in"
                style={{ borderColor: "var(--border)", animationDelay: `${450 + i * 110}ms` }}
              >
                <span
                  className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  <CategoryIcon name={p.category.name} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                  <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{p.category.name}</p>
                </div>
                <p className="text-right shrink-0">
                  <span className="font-display text-base font-extrabold num" style={{ color: "var(--text-primary)" }}>{peso(p.price)}</span>
                  <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>per {p.unit}</span>
                </p>
              </li>
            ))}
      </ul>

      <a
        href="#products"
        className={`group flex items-center justify-between px-6 py-3.5 text-sm font-bold transition-colors hover:bg-[color:var(--bg-subtle)] ${FOCUS_RING}`}
        style={{ color: "var(--brand)", borderTop: "1px solid var(--border)" }}
      >
        See all {productCount > 0 ? productCount : ""} items <ArrowRight size={ICON_SIZE.sm} className="transition-transform duration-200 group-hover:translate-x-1" />
      </a>
    </div>
  );
}

// What the store offers, right under the hero: four plain facts instead of a decorative band.
const SERVICES: [LucideIcon, string, string][] = [
  [Truck, "Delivery", "Brought to the spot you pin on the map"],
  [Store, "Store pickup", "Reserve online, collect in Naval"],
  [Wallet, "Cash or GCash", "Pay whichever way suits you"],
  [Tag, "Live prices", "Updated as stock moves"],
];

function ServiceStrip() {
  return (
    <section aria-label="What we offer" className="border-y" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <ul className="max-w-6xl mx-auto px-5 grid grid-cols-2 lg:grid-cols-4">
        {SERVICES.map(([Icon, title, body], i) => (
          <li
            key={title}
            className={`flex items-center gap-3.5 py-5 sm:py-6 ${i % 2 === 1 ? "pl-4 sm:pl-6" : "pr-4"} ${
              i > 0 ? "lg:pl-6 lg:border-l" : ""
            } ${i % 2 === 1 ? "border-l lg:border-l" : ""} ${i < 2 ? "border-b lg:border-b-0" : ""}`}
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
              style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
            >
              <Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</span>
              <span className="block text-xs leading-snug" style={{ color: "var(--text-muted)" }}>{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({
  index, eyebrow, title, blurb, action,
}: { index: string; eyebrow: string; title: string; blurb: string; action?: React.ReactNode }) {
  return (
    <Reveal className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-display text-xs font-extrabold num tracking-widest" style={{ color: "var(--brand)" }}>{index}</span>
          <span className="heading-rule h-0.5 w-10 rounded-full" style={{ background: "var(--brand)" }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{eyebrow}</span>
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-balance" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{blurb}</p>
      </div>
      {action}
    </Reveal>
  );
}

/* ───────────────────────── Shop by category ───────────────────────── */

function CategoryShowcase({
  loading, categories, productCount, categoryCount, onPick,
}: {
  loading: boolean;
  categories: CategoryWithCount[];
  productCount: number;
  categoryCount: number;
  onPick: (id: number | "all") => void;
}) {
  return (
    <section id="categories" className="scroll-mt-24" style={{ background: "var(--bg-card)" }}>
      <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
        <SectionHeading
          index="01"
          eyebrow="Shop by category"
          title="Start with the job"
          blurb="Pick an aisle to see everything in it, with today's prices."
        />

        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--bg-muted)" }} />
              ))
            : (
              <>
                {categories.map((c, i) => {
                  return (
                    <Reveal key={c.id} delay={(i % 4) * 80} className="h-full">
                    <button
                      type="button"
                      onClick={() => onPick(c.id)}
                      className={`group w-full h-full text-left rounded-2xl border p-5 flex flex-col transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[color:var(--brand)] hover:shadow-[0_10px_28px_-14px_rgba(16,24,64,0.35)] ${FOCUS_RING_LIGHT}`}
                      style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
                    >
                      <span className="flex items-start justify-between">
                        <span
                          className="w-11 h-11 rounded-xl flex items-center justify-center transition-[transform,background-color,color] duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-[color:var(--brand)] group-hover:text-white"
                          style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                        >
                          <CategoryIcon name={c.name} size={20} />
                        </span>
                        <ArrowUpRight
                          size={18}
                          className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          style={{ color: "var(--text-faint)" }}
                        />
                      </span>
                      <span className="mt-5 font-display text-base font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
                        {c.name}
                      </span>
                      {c.description && (
                        <span className="mt-1.5 text-[13px] leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>
                          {c.description}
                        </span>
                      )}
                      <span className="mt-auto pt-4 text-xs font-bold num" style={{ color: "var(--text-secondary)" }}>
                        {c.count} {c.count === 1 ? "item" : "items"}
                      </span>
                    </button>
                    </Reveal>
                  );
                })}
                <Reveal delay={240} className="h-full">
                <button
                  type="button"
                  onClick={() => onPick("all")}
                  className={`group w-full h-full text-left rounded-2xl p-5 flex flex-col text-white transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-14px_rgba(30,79,216,0.75)] ${FOCUS_RING_LIGHT}`}
                  style={{ background: "var(--brand)" }}
                >
                  <span className="flex items-start justify-between">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-[rgba(255,255,255,0.16)]">
                      <Package size={20} />
                    </span>
                    <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                  <span className="mt-5 font-display text-base font-extrabold leading-tight">Everything on the shelf</span>
                  <span className="mt-1.5 text-[13px] leading-snug opacity-85">
                    All {categoryCount} categories in one list.
                  </span>
                  <span className="mt-auto pt-4 text-xs font-bold num">{productCount} items</span>
                </button>
                </Reveal>
              </>
            )}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Catalogue ───────────────────────────── */

function CatalogueSection({
  loading, products, filtered, categories, activeCat, search, visible,
  onSearch, onCategory, onShowMore, onClear,
}: {
  loading: boolean;
  products: Product[];
  filtered: Product[];
  categories: CategoryWithCount[];
  activeCat: number | "all";
  search: string;
  visible: number;
  onSearch: (q: string) => void;
  onCategory: (id: number | "all") => void;
  onShowMore: () => void;
  onClear: () => void;
}) {
  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;

  return (
    <section id="products" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
        <SectionHeading
          index="02"
          eyebrow="What we carry"
          title="Today's prices, straight from the shelf"
          blurb="Prices are per unit and update as stock moves. Sign in when you're ready to order."
        />

        <div className="mt-10 rounded-2xl border p-3 sm:p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <div className="relative">
            <Search size={ICON_SIZE.md} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
            <label htmlFor="catalogue-search" className="sr-only">Search products</label>
            <input
              id="catalogue-search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search cement, nails, plywood, paint..."
              className="w-full pl-11 pr-4 py-3 text-sm border rounded-xl transition focus:outline-none focus:ring-4"
              style={{
                background: "var(--bg-subtle)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
                ["--tw-ring-color" as string]: "var(--brand-soft)",
              }}
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
            <CategoryChip active={activeCat === "all"} onClick={() => onCategory("all")} count={products.length}>
              All
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip key={c.id} active={activeCat === c.id} onClick={() => onCategory(c.id)} count={c.count}>
                {c.name}
              </CategoryChip>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="h-72 rounded-2xl animate-pulse" style={{ background: "var(--bg-muted)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border py-16 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
              <PackageSearch size={40} className="mx-auto mb-3 opacity-25" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                {products.length === 0 ? "The catalogue is being set up." : "Nothing matches that search."}
              </p>
              {products.length > 0 && (
                <button onClick={onClear} className="mt-3 text-sm font-bold hover:underline" style={{ color: "var(--brand)" }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {shown.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 4) * 70} className="h-full">
                    <ProductCard product={p} />
                  </Reveal>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-sm num" style={{ color: "var(--text-muted)" }}>
                  Showing <b style={{ color: "var(--text-primary)" }}>{shown.length}</b> of {filtered.length} items
                </p>
                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={onShowMore}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] ${FOCUS_RING_LIGHT}`}
                    style={{ borderColor: "var(--border-strong)", color: "var(--text-primary)", background: "var(--bg-card)" }}
                  >
                    Show {Math.min(PAGE_SIZE, remaining)} more
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function CategoryChip({
  active, onClick, count, children,
}: { active: boolean; onClick: () => void; count: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 pl-3.5 pr-2 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${FOCUS_RING_LIGHT}`}
      style={
        active
          ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }
          : { background: "transparent", borderColor: "var(--border)", color: "var(--text-secondary)" }
      }
    >
      {children}
      <span
        className="min-w-6 px-1.5 py-0.5 rounded-full text-[11px] font-bold num text-center"
        style={active ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--bg-muted)", color: "var(--text-muted)" }}
      >
        {count}
      </span>
    </button>
  );
}

function ProductCard({ product: p }: { product: Product }) {
  return (
    <article
      className="group h-full rounded-2xl border flex flex-col overflow-hidden transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(16,24,64,0.35)]"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
        {p.image ? (
          <Image
            src={p.image}
            alt={p.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          // No photo yet: show the aisle's icon instead of an empty box.
          <div className="absolute inset-0 flex items-center justify-center">
            <CategoryIcon name={p.category.name} size={40} strokeWidth={1.4} className="relative transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ color: "var(--text-faint)" }} />
          </div>
        )}
        <span
          className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
          style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
        >
          {p.subcategory || p.category.name}
        </span>
        {!p.inStock && (
          <span
            className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-1 rounded-md"
            style={{ background: "var(--bad-soft)", color: "var(--bad)" }}
          >
            Out of stock
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-bold leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
          {p.name}
        </h3>
        {/* Two-up cards on phones are too narrow for price and button side by side. */}
        <div className="mt-auto pt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
          <p>
            <span className="block font-display text-lg font-extrabold num leading-none" style={{ color: "var(--text-primary)" }}>
              {peso(p.price)}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>per {p.unit}</span>
          </p>
          {/* Colours are set with classes, not an inline style: an inline `color`
              would outrank the `hover:text-white` class and leave blue text on a
              blue fill on hover. */}
          <Link
            href={ORDER_HREF}
            aria-label={`Order ${p.name}`}
            className={`shrink-0 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors border-[color:var(--brand)] text-[color:var(--brand)] hover:bg-[color:var(--brand)] hover:text-white ${FOCUS_RING_LIGHT}`}
          >
            Order <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ───────────────────────────── How to order ───────────────────────────── */

function HowItWorks() {
  const steps = [
    { icon: PackageSearch, title: "Browse the shelf", body: "Everything on this page is what the store actually stocks, at the price you'll pay. No account needed to look." },
    { icon: LogIn, title: "Create your account", body: "Sign up as a customer in under a minute. It only asks for a username, a contact number and a password." },
    { icon: Truck, title: "Order and track", body: "Pin your delivery spot or choose pickup, pay cash or GCash, then follow your driver on the map until it arrives." },
  ];

  return (
    <section id="how" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
        <SectionHeading
          index="03"
          eyebrow="How to order"
          title="From browsing to your door in three steps"
          blurb="Ordering online takes a few minutes. Delivery and pickup both start from the same order."
        />

        <ol className="mt-12 grid md:grid-cols-3 gap-10 md:gap-8">
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <Reveal delay={i * 140}>
              {/* Connector to the next step: across on wide screens, down on phones */}
              {i < steps.length - 1 && (
                <>
                  <span aria-hidden className="hidden md:block absolute top-6 left-16 right-0 border-t-2 border-dashed" style={{ borderColor: "var(--border-strong)" }} />
                  <span aria-hidden className="md:hidden absolute top-14 bottom-[-2.5rem] left-6 border-l-2 border-dashed" style={{ borderColor: "var(--border-strong)" }} />
                </>
              )}
              <div className="flex md:block gap-5">
                <span
                  className="relative z-[1] w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-display text-base font-extrabold num border-2"
                  style={{ borderColor: "var(--brand)", color: "var(--brand)", background: "var(--bg-card)" }}
                >
                  {i + 1}
                </span>
                <div className="md:mt-6">
                  <p className="flex items-center gap-2 font-display text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                    <s.icon size={18} style={{ color: "var(--brand)" }} /> {s.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed max-w-xs" style={{ color: "var(--text-muted)" }}>{s.body}</p>
                </div>
              </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal className="mt-14">
        <div
          className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
          style={{ background: "var(--brand)" }}
        >
          <div>
            <p className="font-display text-xl font-extrabold text-white">Ready when you are.</p>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.82)" }}>
              Create a free customer account and place your first order today.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={SIGNUP_HREF}
              className={`group inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition hover:brightness-95 active:scale-[0.98] ${FOCUS_RING}`}
              style={{ background: "#ffffff", color: "var(--brand)" }}
            >
              Create a customer account <ArrowRight size={ICON_SIZE.sm} className="transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className={`inline-flex items-center px-4 py-3 rounded-xl text-sm font-bold text-white transition-colors hover:bg-[rgba(255,255,255,0.12)] ${FOCUS_RING}`}
            >
              I already have one
            </Link>
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────────── Visit us ───────────────────────────── */

type StoreLocation = { lat: number; lng: number; name: string };

function VisitUs({ displayName }: { displayName: string }) {
  const [location, setLocation] = useState<StoreLocation | null>(null);

  useEffect(() => {
    fetch("/api/store-location")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.lat === "number" && typeof d.lng === "number") setLocation(d); })
      .catch(() => {});
  }, []);

  const directions = location
    ? `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`
    : null;

  const details = [
    { icon: MapPin, label: "Where", value: "Naval, Biliran" },
    { icon: Truck, label: "Delivery", value: "Brought to the spot you pin on the map" },
    { icon: Store, label: "Pickup", value: "Reserve online, collect at the store" },
    { icon: Wallet, label: "Payment", value: "Cash or GCash" },
  ];

  return (
    <section id="visit" className="scroll-mt-24 border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
        <SectionHeading
          index="04"
          eyebrow="Visit us"
          title="Come by the store"
          blurb="Prefer to see it in person? Here's where to find us."
        />

        <Reveal className="mt-10 grid lg:grid-cols-[0.85fr_1.15fr] gap-4">
          <div className="rounded-2xl border p-6 sm:p-7 flex flex-col" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={44} height={44} className="object-contain" />
              <div>
                <p className="font-display text-lg font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{displayName}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Hardware and building supply</p>
              </div>
            </div>

            <dl className="mt-6 divide-y" style={{ borderColor: "var(--border)" }}>
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3.5 py-3.5" style={{ borderColor: "var(--border)" }}>
                  <span
                    className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</dt>
                    <dd className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-auto pt-6 flex flex-wrap gap-2.5">
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:brightness-110 ${FOCUS_RING_LIGHT}`}
                  style={{ background: "var(--brand)" }}
                >
                  <Navigation size={ICON_SIZE.sm} /> Get directions
                </a>
              )}
              <Link
                href={ORDER_HREF}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] ${FOCUS_RING_LIGHT}`}
                style={{ borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
              >
                Order online instead
              </Link>
            </div>
          </div>

          {/* `isolate` keeps Leaflet's high z-index panes underneath the sticky header. */}
          <div className="relative isolate h-[320px] lg:h-auto lg:min-h-[420px] rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {location ? (
              <StoreMap lat={location.lat} lng={location.lng} name={displayName} />
            ) : (
              <div className="h-full w-full animate-pulse" style={{ background: "var(--bg-muted)" }} />
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────────── Footer ───────────────────────────── */

function SiteFooter({ displayName }: { displayName: string }) {
  const columns = [
    {
      title: "Shop",
      links: [
        { label: "Categories", href: "#categories" },
        { label: "Products", href: "#products" },
        { label: "How to order", href: "#how" },
        { label: "Visit us", href: "#visit" },
      ],
    },
    {
      title: "Your account",
      links: [
        { label: "Sign in", href: "/login" },
        { label: "Create an account", href: SIGNUP_HREF },
        { label: "Track an order", href: "/login?next=/orders" },
      ],
    },
    {
      title: "Staff",
      links: [{ label: "Management system", href: "/login" }],
    },
  ];

  return (
    <footer style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}>
      <div className="max-w-6xl mx-auto px-5 pt-14 pb-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={40} height={40} className="object-contain" />
              <span className="font-display font-extrabold text-lg" style={{ color: "var(--text-primary)" }}>{displayName}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed max-w-xs" style={{ color: "var(--text-muted)" }}>
              Building materials and hardware supply in Naval, Biliran. Order online for delivery or store pickup.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className={`text-sm font-semibold rounded transition-colors text-[color:var(--text-secondary)] hover:text-[color:var(--brand)] ${FOCUS_RING}`}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <p>© {new Date().getFullYear()} {displayName}. All rights reserved.</p>
          <p>Prices in Philippine pesos (₱), per unit.</p>
        </div>
      </div>
    </footer>
  );
}
