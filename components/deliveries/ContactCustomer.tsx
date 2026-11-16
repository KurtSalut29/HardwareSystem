import { Phone, MessageSquare, PhoneOff } from "lucide-react";

/**
 * One-tap Call and Text buttons so a driver can reach the customer from the
 * road: running late, can't find the house, nobody at the gate. On a phone,
 * "tel:" opens the dialer and "sms:" opens messages with the number filled in.
 */
export default function ContactCustomer({ phone, name, orderId, className = "" }: {
  phone: string | null;
  name: string;
  orderId: number;
  className?: string;
}) {
  if (!phone) {
    return (
      <p className={`flex items-center gap-2 rounded-xl bg-recess px-3 py-2.5 text-[12.5px] text-ink-3 ${className}`}>
        <PhoneOff className="size-4 shrink-0 text-ink-4" /> No phone number on file for {name}. Ask the store to call them.
      </p>
    );
  }
  const sms = `sms:${phone}?body=${encodeURIComponent(`Hi ${name}, this is your RM Hardware driver for order #${orderId}.`)}`;
  return (
    <div className={`flex gap-2 ${className}`}>
      <a href={`tel:${phone}`} aria-label={`Call ${name} at ${phone}`}
        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-brand/35 bg-brand-soft text-[14px] font-semibold text-brand-ink transition hover:border-brand active:scale-[0.98]">
        <Phone className="size-4" /> Call <span className="num font-normal text-brand">{phone}</span>
      </a>
      <a href={sms} aria-label={`Text ${name}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold text-ink-2 transition hover:border-brand/40 hover:text-brand-ink active:scale-[0.98]">
        <MessageSquare className="size-4" /> Text
      </a>
    </div>
  );
}
