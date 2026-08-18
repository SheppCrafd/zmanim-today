import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, useReducedMotion } from "framer-motion";
import { formatTime } from "@/lib/timeUtils";

export default function ZmanimCard({ title, icon, color, times, use24Hour, timezone }) {
  // Skip the entrance/stagger motion entirely for users who've asked the OS
  // for reduced motion — the row list still renders, just without movement.
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="shadow-md border-0 overflow-hidden bg-card">
        <CardHeader className={`bg-gradient-to-r ${color} p-4`}>
          <CardTitle className="text-primary-foreground flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <span className="text-lg font-semibold">{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {times.map((time, index) => (
              <motion.div
                key={index}
                initial={reduceMotion ? false : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: reduceMotion ? 0 : index * 0.05 }}
                className={`p-4 hover:bg-accent transition-colors ${
                  time.highlight ? "bg-amber-50/50 dark:bg-amber-950/20" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p
                      className={`font-semibold ${
                        time.highlight ? "text-foreground" : "text-foreground/80"
                      }`}
                    >
                      {time.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {time.description}
                    </p>
                  </div>
                  <div
                    className={`text-right font-mono text-lg font-bold tabular-nums ${
                      time.highlight
                        ? "text-primary bg-primary/10 px-3 py-1 rounded-lg"
                        : "text-foreground/80"
                    }`}
                  >
                    {formatTime(time.value, use24Hour, timezone)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
