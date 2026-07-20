import { MapPin } from "lucide-react";

export default function LocationDisplay({ location }) {
  if (!location) return null;
  const hasName = location.city || location.state || location.country;

  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
        <MapPin className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-slate-600">Your Location</p>
        <p className="font-semibold text-slate-800">
          {hasName
            ? [location.city, location.state, location.country]
                .filter(Boolean)
                .join(", ")
            : `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`}
        </p>
      </div>
    </div>
  );
}
