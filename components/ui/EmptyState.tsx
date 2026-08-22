import { LucideIcon } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
};

export default function EmptyState({ icon: Icon, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--bg-muted)" }}>
        <Icon size={ICON_SIZE.xl} style={{ color: "var(--text-faint)" }} />
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{title}</p>
      {description && <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>{description}</p>}
    </div>
  );
}
