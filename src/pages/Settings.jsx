import { useState } from "react";
import {
  GripVertical,
  Check,
  ArrowLeft,
  Moon,
  BookOpen,
  LogOut,
  Trash2,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import NavMenu from "@/components/NavMenu";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex items-center mb-6 min-h-[56px]">
          <div className="shrink-0">
            <NavMenu />
          </div>
          <div className="flex-1 text-center px-2">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Settings
            </h1>
            <p className="text-slate-500 text-sm">Customize your dashboard</p>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-white/90 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1 text-sm text-slate-700 pr-3"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>

        {/* Location */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
            Location
          </p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {location ? (
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {[location.city, location.state, location.country]
                      .filter(Boolean)
                      .join(", ") ||
                      `${location.latitude?.toFixed(3)}°, ${location.longitude?.toFixed(3)}°`}
                  </p>
                  <p className="text-xs text-slate-400">Current location</p>
                </div>
                <button
                  onClick={clearLocation}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm text-slate-500">
                  No location set. Set one from the Home screen.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Appearance */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
            Appearance
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={toggleDark}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-indigo-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Dark Mode
                  </p>
                  <p className="text-xs text-slate-400">
                    Easy on the eyes for night prayer
                  </p>
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${dark ? "bg-indigo-600" : "bg-slate-200"}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${dark ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Time Format */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
            Time Format
          </p>
          <div className="bg-white rounded-xl border border-slate-200">
            <button
              onClick={toggle24Hour}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  24-Hour Time
                </p>
                <p className="text-xs text-slate-400">
                  Show times in 24h format (e.g. 18:30)
                </p>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${prefs.use24Hour ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.use24Hour ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Dashboard Items */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
            Home Dashboard
          </p>
          <p className="text-xs text-slate-400 mb-3 px-1">
            Toggle items and drag to reorder.
          </p>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="dashboard-items">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100"
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
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${snapshot.isDragging ? "bg-blue-50 shadow-md" : "bg-white"}`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="w-4 h-4 text-slate-300" />
                          </div>
                          <span className="text-base">{getIcon(item.id)}</span>
                          <span className="flex-1 text-sm font-medium text-slate-700">
                            {getLabel(item.id)}
                          </span>
                          <button
                            onClick={() => toggleItem(item.id)}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              item.enabled
                                ? "bg-blue-600 border-blue-600"
                                : "bg-white border-slate-300"
                            }`}
                          >
                            {item.enabled && (
                              <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
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
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
            Documentation
          </p>
          <a
            href="https://zmanimtoday.mintlify.site/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  App Documentation
                </p>
                <p className="text-xs text-slate-400">
                  Guides, zmanim references, and help
                </p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 12l4-4-4-4"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        {/* Account */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
            Account
          </p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 text-slate-500" />
              )}
              <span className="text-sm font-medium text-slate-700">
                {loggingOut ? "Logging out…" : "Log Out"}
              </span>
            </button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600">
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
                  <p className="text-sm text-red-600">{deleteError}</p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 text-white"
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
      </div>
    </div>
  );
}