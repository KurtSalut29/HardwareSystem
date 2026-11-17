"use client";

import { createElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Ban, Boxes, CreditCard, MapPin, Receipt, SlidersHorizontal, Smartphone, Store, Truck, UserCog, UserRound, Wallet,
  type LucideIcon,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import AccountSection from "@/components/settings/AccountSection";
import PreferencesSection from "@/components/settings/PreferencesSection";
import AddressesSection from "@/components/settings/AddressesSection";
import StoreSettingsForm from "@/components/settings/StoreSettingsForm";
import { DeliveryFeesCard, StorePinCard, TestEmailCard } from "@/components/settings/AdminExtras";

type Tab = { key: string; label: string; icon: LucideIcon; hint: string };

const PERSONAL: Tab[] = [
  { key: "account", label: "My account", icon: UserRound, hint: "Email, mobile number, password" },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal, hint: "Appearance, alerts, app" },
];
const CUSTOMER_EXTRA: Tab[] = [{ key: "addresses", label: "Addresses", icon: MapPin, hint: "Where you have orders delivered" }];
const STORE: Tab[] = [
  { key: "store", label: "Store details", icon: Store, hint: "Name, address, hours, map pin" },
  { key: "gcash", label: "GCash", icon: Smartphone, hint: "Account, number, QR code" },
  { key: "payments", label: "Payments", icon: Wallet, hint: "Cash, downpayments, balances" },
  { key: "cancellation", label: "Cancellations & refunds", icon: Ban, hint: "When customers can cancel, fees" },
  { key: "delivery", label: "Orders & delivery", icon: Truck, hint: "Delivery, pickup, fees, drivers" },
  { key: "inventory", label: "Inventory", icon: Boxes, hint: "Low-stock level, stock shown to customers" },
  { key: "accounts", label: "Accounts & email", icon: UserCog, hint: "Customer approval, store email" },
  { key: "receipts", label: "Receipts", icon: Receipt, hint: "Message on receipts" },
];

export default function SettingsClient({ role }: { role: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const personal = role === "customer" ? [PERSONAL[0], ...CUSTOMER_EXTRA, PERSONAL[1]] : PERSONAL;
  const all = isAdmin ? [...personal, ...STORE] : personal;
  const requested = params.get("tab");
  const tab = all.find((t) => t.key === requested)?.key ?? (isAdmin ? "store" : "account");

  const go = (key: string) => router.replace(`${pathname}?tab=${key}`, { scroll: false });

  const navGroup = (title: string, tabs: Tab[]) => (
    <div>
      <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-4">{title}</p>
      <ul className="space-y-0.5">
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <li key={t.key}>
              <button type="button" onClick={() => go(t.key)} aria-current={on ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-recess"}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${on ? "bg-brand text-white" : "bg-recess text-ink-3"}`}>{createElement(t.icon, { className: "size-4" })}</span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">{t.label}</span>
                  <span className="block truncate text-[11.5px] text-ink-4">{t.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Settings" title={isAdmin ? "Settings" : "Settings"}
        subtitle={isAdmin ? "Your own account, and everything about how the store runs. Changes apply right away." : "Your account and how the app works for you."} />

      {/* Phones and tablets: sections as a scrolling row */}
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 lg:hidden">
        {all.map((t) => (
          <button key={t.key} type="button" onClick={() => go(t.key)} aria-current={t.key === tab ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${t.key === tab ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2"}`}>
            {createElement(t.icon, { className: "size-4" })} {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden space-y-5 self-start rounded-2xl border border-line bg-surface p-2.5 lg:sticky lg:top-4 lg:block">
          {navGroup(isAdmin ? "Your account" : "Settings", personal)}
          {isAdmin && navGroup("Store", STORE)}
        </nav>

        <div className="min-w-0 space-y-5">
          {tab === "account" && <AccountSection />}
          {tab === "addresses" && <AddressesSection />}
          {tab === "preferences" && <PreferencesSection role={role} />}

          {tab === "store" && (
            <>
              <StoreSettingsForm group="store" title="Store details" icon={<Store className="size-5" />}
                description="Shown on receipts, emails and the home page." savedMessage="Store details saved." />
              <StorePinCard />
            </>
          )}
          {tab === "gcash" && (
            <StoreSettingsForm group="gcash" title="GCash" icon={<Smartphone className="size-5" />}
              description="Where customers send GCash payments. They see these details and the QR code at checkout."
              notice={<Alert tone="info" compact>Double-check the number and QR before saving — customers send money to whatever is shown here.</Alert>}
              savedMessage="GCash details saved. Customers see them at checkout now." />
          )}
          {tab === "payments" && (
            <StoreSettingsForm group="payments" title="Payments" icon={<CreditCard className="size-5" />}
              description="How customers may pay, and the rules for downpayments and balances."
              notice={<Alert tone="info" compact>Customers see these rules at checkout, before they pay. Orders already placed keep the rules they were placed under.</Alert>}
              savedMessage="Payment rules saved. Checkout uses them now." />
          )}
          {tab === "cancellation" && (
            <StoreSettingsForm group="cancellation" title="Cancellations and refunds" icon={<Ban className="size-5" />}
              description="When a customer may cancel, and how much of what they paid comes back."
              notice={<Alert tone="info" compact>Customers must agree to the policy before ordering, and they see the exact refund before they confirm a cancellation. Orders the store cancels are always refunded in full.</Alert>}
              savedMessage="Cancellation and refund rules saved." />
          )}
          {tab === "delivery" && (
            <>
              <StoreSettingsForm group="orders" title="Delivery and pickup" icon={<Truck className="size-5" />}
                description="Which ways customers can get their order." savedMessage="Delivery and pickup options saved."
                notice={<Alert tone="warn" compact>Turning off both delivery and pickup stops customers from ordering online. Staff can still take orders.</Alert>} />
              <DeliveryFeesCard />
            </>
          )}
          {tab === "inventory" && (
            <StoreSettingsForm group="inventory" title="Inventory shown to customers" icon={<Boxes className="size-5" />}
              description="What customers see about stock on the home page and in the shop. Reorder points for restocking are set per product in Restocks."
              savedMessage="Inventory settings saved." />
          )}
          {tab === "accounts" && (
            <>
              <StoreSettingsForm group="accounts" title="Customer accounts" icon={<UserCog className="size-5" />}
                description="Who can order, and the emails customers receive." savedMessage="Account settings saved." />
              <TestEmailCard />
            </>
          )}
          {tab === "receipts" && (
            <StoreSettingsForm group="receipts" title="Receipts" icon={<Receipt className="size-5" />}
              description="Every receipt shows the store's name, address and contact number from Store details, and is marked &quot;Not an official receipt&quot;."
              savedMessage="Receipt settings saved." />
          )}
        </div>
      </div>
    </div>
  );
}
