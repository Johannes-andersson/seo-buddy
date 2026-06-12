import { Check, AlertTriangle, X } from "lucide-react";

type Status = "good" | "warn" | "bad";

interface CheckItem {
  label: string;
  status: Status;
  detail: string;
}

const STYLES: Record<Status, { bg: string; fg: string; Icon: typeof Check }> = {
  good: { bg: "bg-status-good/10", fg: "text-status-good", Icon: Check },
  warn: { bg: "bg-status-warn/10", fg: "text-status-warn", Icon: AlertTriangle },
  bad: { bg: "bg-status-bad/10", fg: "text-status-bad", Icon: X },
};

export function CheckList({ items }: { items: CheckItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c, i) => {
        const s = STYLES[c.status];
        const Icon = s.Icon;
        return (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-lg border p-3 ${s.bg}`}
          >
            <div className={`mt-0.5 shrink-0 ${s.fg}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{c.label}</div>
              <div className="text-sm text-muted-foreground break-words">
                {c.detail}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}