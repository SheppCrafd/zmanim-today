import { MapPin } from "lucide-react";

export default function LocationDisplay({ location }) {
  if (!location) return null;
  const hasName = location.city || location.state || location.country;

  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-sm">
        <MapPin className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Your Location</p>
        <p className="font-semibold text-foreground">
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
