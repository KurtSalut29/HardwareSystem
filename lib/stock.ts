/** Why stock changed outside a sale or a purchase. Shared by the form and the API. */
export const ADJUST_REASONS = ["Damaged", "Lost / missing", "Count correction", "Customer return", "Own use", "Other"] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];
