import NavMenu from "@/components/NavMenu";

// Shared chrome for every page's small square icon buttons (nav, settings,
// back, reminders) so they're pixel-identical wherever they appear.
export const iconButtonClass =
  "p-2 rounded-lg bg-card border border-border shadow-sm hover:bg-accent active:scale-95 transition-all";

// One header treatment for every top-level page — same height, same title
// scale, same NavMenu slot — so the app doesn't visually reset size each time
// you navigate. `right` renders page-specific actions (falls back to a
// same-width spacer so the title still centers).
export default function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-center mb-6 min-h-[56px]">
      <div className="shrink-0">
        <NavMenu />
      </div>
      <div className="flex-1 text-center px-2 min-w-0">
        <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {right ?? <div className="w-9" />}
      </div>
    </div>
  );
}
