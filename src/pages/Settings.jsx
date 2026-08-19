import { useState } from "react";
import {
  GripVertical,
  Check,
  ArrowLeft,
  Moon,
  BookOpen,
  ShieldCheck,
  LogOut,
  Trash2,
  Loader2,
  Mail,
  Github,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader, { iconButtonClass } from "@/components/PageHeader";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  useDashboardPrefs,
  ALL_DASHBOARD_ITEMS,
} from "@/hooks/useDashboardPrefs";
import { useSavedLocation } from "@/hooks/useLocation";
import { useTheme } from "@/lib/ThemeContext";
import { base44 } from "@/api/base44Client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Maintainer contact card, sourced from the Gravatar profile at
// gravatar.com/sheppcrafd.
const MAINTAINER = {
  name: "SheppCrafd",
  bio: "Builds mods, builds robots, builds modded robots",
  avatar: "https://0.gravatar.com/avatar/2daa5fe613a74df44eda666f4db3967a88369f873fd614400b4660d986d0d3d6?s=200",
  github: "https://github.com/SheppCrafd",
  email: "mwallis31@outlook.com",
};

export default function Settings() {
  const navigate = useNavigate();
  const { prefs, toggleItem, reorderItems, toggle24Hour } = useDashboardPrefs();
  const { location, clearLocation } = useSavedLocation();
  const { dark, toggleDark } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    await base44.auth.logout("/");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await base44.functions.invoke("deleteAccount");
      await base44.auth.logout("/");
    } catch (error) {
      setDeleting(false);
      setDeleteError(
        error?.response?.data?.error || "Failed to delete account.",
      );
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(prefs.items);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    reorderItems(items);
  };

  const getLabel = (id) =>
    ALL_DASHBOARD_ITEMS.find((i) => i.id === id)?.label || id;
  const getIcon = (id) =>
    ALL_DASHBOARD_ITEMS.find((i) => i.id === id)?.icon || "⏱";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-4">
        <PageHeader
          title="Settings"
          subtitle="Customize your dashboard"
          right={
            <button
              onClick={() => navigate(-1)}
              className={`${iconButtonClass} flex items-center gap-1 text-sm text-foreground pr-3`}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          }
        />

        {/* Location */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Location
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
            {location ? (
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {[location.city, location.state, location.country]
                      .filter(Boolean)
                      .join(", ") ||
                      `${location.latitude?.toFixed(3)}°, ${location.longitude?.toFixed(3)}°`}
                  </p>
                  <p className="text-xs text-muted-foreground">Current location</p>
                </div>
                <button
                  onClick={clearLocation}
                  className="text-xs text-destructive hover:text-destructive/80 font-medium"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  No location set. Set one from the Home screen.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Appearance */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Appearance
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <button
              onClick={toggleDark}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    Dark Mode
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Easy on the eyes for night prayer
                  </p>
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${dark ? "bg-primary" : "bg-muted"}`}
              >
                <div
                  className={`w-5 h-5 bg-background rounded-full shadow transition-transform ${dark ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Time Format */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Time Format
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <button
              onClick={toggle24Hour}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  24-Hour Time
                </p>
                <p className="text-xs text-muted-foreground">
                  Show times in 24h format (e.g. 18:30)
                </p>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${prefs.use24Hour ? "bg-primary" : "bg-muted"}`}
              >
                <div
                  className={`w-5 h-5 bg-background rounded-full shadow transition-transform ${prefs.use24Hour ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Dashboard Items */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Home Dashboard
          </p>
          <p className="text-xs text-muted-foreground mb-3 px-1">
            Toggle items and drag to reorder.
          </p>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="dashboard-items">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="bg-card rounded-xl border border-border shadow-sm overflow-hidden divide-y divide-border"
                >
                  {prefs.items.map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${snapshot.isDragging ? "bg-primary/10 shadow-md" : "bg-card"}`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="w-4 h-4 text-muted-foreground/60" />
                          </div>
                          <span className="text-base">{getIcon(item.id)}</span>
                          <span className="flex-1 text-sm font-medium text-foreground">
                            {getLabel(item.id)}
                          </span>
                          <button
                            onClick={() => toggleItem(item.id)}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              item.enabled
                                ? "bg-primary border-primary"
                                : "bg-background border-border"
                            }`}
                          >
                            {item.enabled && (
                              <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                            )}
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Documentation */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Documentation
          </p>
          <a
            href="https://zmanimtoday.mintlify.site/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3 bg-card rounded-xl border border-border shadow-sm hover:bg-accent active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  App Documentation
                </p>
                <p className="text-xs text-muted-foreground">
                  Guides, zmanim references, and help
                </p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-muted-foreground shrink-0">
              <path
                d="M6 12l4-4-4-4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <button
            onClick={() => navigate("/Privacy")}
            className="w-full flex items-center justify-between px-4 py-3 mt-2 bg-card rounded-xl border border-border shadow-sm hover:bg-accent active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">
                  Privacy Policy
                </p>
                <p className="text-xs text-muted-foreground">
                  What we collect and why
                </p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="stroke-muted-foreground shrink-0">
              <path
                d="M6 12l4-4-4-4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* About */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            About
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <img
                src={MAINTAINER.avatar}
                alt={MAINTAINER.name}
                className="w-12 h-12 rounded-full border border-border shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {MAINTAINER.name}
                </p>
                <p className="text-xs text-muted-foreground">{MAINTAINER.bio}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
              <a
                href={`mailto:${MAINTAINER.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                {MAINTAINER.email}
              </a>
              <a
                href={MAINTAINER.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-4 h-4 shrink-0" />
                GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Account
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-foreground">
                {loggingOut ? "Logging out…" : "Log Out"}
              </span>
            </button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    Delete Account
                  </span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes your account and saved push
                    subscriptions. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError && (
                  <p className="text-sm text-destructive">{deleteError}</p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {deleting ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          Zmanim Today, built by{" "}
          <a
            href={MAINTAINER.github}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            {MAINTAINER.name}
          </a>
        </p>
      </div>
    </div>
  );
}