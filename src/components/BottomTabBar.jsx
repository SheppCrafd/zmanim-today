import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Clock, Compass, BookOpen, Settings } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SIDDURIM = [
  {
    label: "Sephardic Siddur",
    path: "/SephardicSiddur",
    description: "Edot HaMizrach",
  },
  {
    label: "Ashkenazi Siddur",
    path: "/AshkenaziSiddur",
    description: "Nusach Ashkenaz",
  },
  {
    label: "Weekday Chabad Siddur",
    path: "/ChabadSiddur",
    description: "Nusach Ari",
  },
];

const SIDDUR_PREFIXES = ["/SephardicSiddur", "/AshkenaziSiddur", "/ChabadSiddur"];

function TabButton({ isActive, onClick, icon: Icon, label, ...props }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[56px] active:scale-90 transition-transform"
      {...props}
    >
      <Icon
        className={`w-5 h-5 ${isActive ? "text-primary" : "text-slate-400 dark:text-slate-500"}`}
        strokeWidth={isActive ? 2.5 : 2}
      />
      <span
        className={`text-[10px] leading-none ${isActive ? "text-primary font-semibold" : "text-slate-400 dark:text-slate-500 font-medium"}`}
      >
        {label}
      </span>
    </button>
  );
}

// Primary navigation for every top-level ("tab") page — rendered fixed at
// the bottom, native-app style, instead of the hamburger-drawer pattern
// (NavMenu, now retired) that used to live in each page's own header. Not
// rendered inside the Siddur reading views themselves (SiddurView.jsx) —
// those are a deliberate full-screen focused mode, the same way a reading
// app hides its own tab bar once you're actually reading.
export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSiddurSheetOpen, setIsSiddurSheetOpen] = useState(false);

  const isSiddurActive = SIDDUR_PREFIXES.some((p) =>
    location.pathname.startsWith(p),
  );

  const openSiddur = (path) => {
    setIsSiddurSheetOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <TabButton
          icon={Home}
          label="Home"
          isActive={location.pathname === "/"}
          onClick={() => navigate("/")}
        />
        <TabButton
          icon={Clock}
          label="Zmanim"
          isActive={location.pathname === "/Zmanim"}
          onClick={() => navigate("/Zmanim")}
        />
        <TabButton
          icon={Compass}
          label="Compass"
          isActive={location.pathname === "/Compass"}
          onClick={() => navigate("/Compass")}
        />
        <TabButton
          icon={BookOpen}
          label="Siddur"
          isActive={isSiddurActive}
          onClick={() => setIsSiddurSheetOpen(true)}
        />
        <TabButton
          icon={Settings}
          label="Settings"
          isActive={location.pathname === "/Settings"}
          onClick={() => navigate("/Settings")}
        />
      </nav>

      <Sheet open={isSiddurSheetOpen} onOpenChange={setIsSiddurSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>Choose a Siddur</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2">
            {SIDDURIM.map(({ label, path, description }) => (
              <button
                key={path}
                onClick={() => openSiddur(path)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-[0.98] transition-all text-left"
              >
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
