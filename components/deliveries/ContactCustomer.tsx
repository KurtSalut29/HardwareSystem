import { Phone, MessageSquare } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";

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
      <p className={`text-xs text-gray-400 ${className}`}>No phone number on file for {name}. Ask the store to call them.</p>
    );
  }
  const sms = `sms:${phone}?body=${encodeURIComponent(`Hi ${name}, this is your RM Hardware driver for order #${orderId}.`)}`;
  return (
    <div className={`flex gap-2 ${className}`}>
      <a href={`tel:${phone}`} aria-label={`Call ${name} at ${phone}`}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold py-2.5 text-white transition hover:opacity-90 active:scale-[0.98]"
        style={{ background: "var(--brand)" }}>
        <Phone size={ICON_SIZE.sm} /> Call <span className="font-normal opacity-90 num">{phone}</span>
      </a>
      <a href={sms} aria-label={`Text ${name}`}
        className="inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-semibold px-4 py-2.5 transition hover:bg-blue-50"
        style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
        <MessageSquare size={ICON_SIZE.sm} /> Text
      </a>
    </div>
  );
}
