import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Mail, Bell, ExternalLink } from "lucide-react";
import PageHeader, { iconButtonClass } from "@/components/PageHeader";

// Third parties that receive data as part of normal app operation, and
// exactly what each one sees. Kept in one place so this stays accurate as
// the app's data flows change — see useLocation.js, useZmanim.js, and
// usePushReminders.js for the actual calls this describes.
const THIRD_PARTIES = [
  {
    name: "Hebcal",
    url: "https://www.hebcal.com/",
    receives:
      "Your GPS coordinates (or the coordinates of a place you search for) and the current date, to compute halachic zmanim for that location.",
  },
  {
    name: "BigDataCloud",
    url: "https://www.bigdatacloud.com/",
    receives:
      "Your GPS coordinates, to reverse-geocode them into a city/state/country label shown in the app.",
  },
  {
    name: "TimeAPI.io",
    url: "https://timeapi.io/",
    receives:
      "Your GPS coordinates, to resolve the IANA timezone for that location.",
  },
  {
    name: "Open-Meteo",
    url: "https://open-meteo.com/",
    receives:
      "The text of a location you search for (e.g. a city name), to look up its coordinates.",
  },
];

// What we collect, grouped the same way Settings groups its rows: one icon
// + title + description per row, inside a single divided card, instead of a
// generic bullet list.
const DATA_COLLECTED = [
  {
    icon: MapPin,
    title: "Location (GPS coordinates)",
    description:
      "Used to compute zmanim for where you are and to point the compass toward Jerusalem. Requested only when you tap “detect location”; you can instead search for a place by name. Stored locally on your device (localStorage) so it persists between visits; cleared any time from Settings.",
  },
  {
    icon: Mail,
    title: "Email address",
    description:
      "Collected when you create an account, used for sign-in and account recovery.",
  },
  {
    icon: Bell,
    title: "Push subscription data",
    description:
      "If you enable reminders, your browser generates a push subscription (an endpoint URL and encryption keys, no personal info) that we store so our server can deliver zman reminders even when the app is closed. Removed when you disable reminders or delete your account.",
  },
];

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-4">
        <PageHeader
          title="Privacy Policy"
          subtitle="What we collect and why"
          right={
            <button
              onClick={() => navigate(-1)}
              className={`${iconButtonClass} flex items-center gap-1 text-sm text-foreground pr-3`}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          }
        />

        {/* Summary reads as lead copy, not another card, so it sets context
            for the itemized sections below rather than blending into them. */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Zmanim Today collects only what it needs to compute your prayer
          times, keep you signed in, and (if you opt in) deliver push
          reminders. We don't sell your data, and we don't use it for
          advertising. Location and time data are sent to the third-party
          APIs below solely to compute results for you — see{" "}
          <a
            href="https://zmanimtoday.mintlify.app/technical/zman-calculations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            our zman calculation methodology
          </a>{" "}
          for how those results are derived.
        </p>

        {/* What we collect */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            What we collect
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
            {DATA_COLLECTED.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3 px-4 py-3">
                <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Third parties */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Third parties that receive your data
          </p>
          <p className="text-xs text-muted-foreground mb-2 px-1">
            These requests go directly from your browser to each service —
            we don't proxy or log the responses ourselves beyond what's
            cached locally on your device.
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
            {THIRD_PARTIES.map((tp) => (
              <a
                key={tp.name}
                href={tp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-accent transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {tp.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tp.receives}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
              </a>
            ))}
          </div>
        </div>

        {/* Your controls */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Your controls
          </p>
          <div className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border">
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">
                You can clear your saved location, disable push reminders,
                or delete your account entirely from{" "}
                <a
                  href="/Settings"
                  className="text-primary hover:underline"
                >
                  Settings
                </a>
                . Deleting your account removes your saved push subscription
                from our server.
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Questions about this policy or your data? Reach out from the
                contact card on the{" "}
                <a
                  href="/Settings"
                  className="text-primary hover:underline"
                >
                  Settings
                </a>{" "}
                page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
