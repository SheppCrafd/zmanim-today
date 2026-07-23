import { useState, useEffect, useRef } from "react";

export function useCompassHeading() {
  const [heading, setHeading] = useState(0);
  const [supported, setSupported] = useState(true);
  const smoothRef = useRef(0);
  const targetRef = useRef(0);
  const frameRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    // The smoothing loop only runs while there's a real angle left to
    // converge toward, and stops the instant it settles — it's restarted by
    // the next real sensor event. Previously this scheduled
    // requestAnimationFrame unconditionally forever from the moment the
    // compass mounted, which on any device with no magnetometer (most
    // desktop browsers, some Android configs) meant a permanent 60fps loop
    // computing nothing for as long as Home's compass widget (on by
    // default) or the Compass page stayed open.
    const animate = () => {
      let diff = targetRef.current - smoothRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      smoothRef.current = smoothRef.current + diff * 0.1;
      setHeading((prev) =>
        Math.abs(smoothRef.current - prev) < 0.05 ? prev : smoothRef.current,
      );
      if (Math.abs(diff) > 0.05) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        runningRef.current = false;
      }
    };

    const kickAnimation = () => {
      if (!runningRef.current) {
        runningRef.current = true;
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    const handleOrientation = (e) => {
      let h =
        e.webkitCompassHeading != null
          ? e.webkitCompassHeading
          : e.alpha != null
            ? (360 - e.alpha) % 360
            : null;
      if (h == null) return;
      targetRef.current = h;
      kickAnimation();
    };

    const setup = async () => {
      if (typeof DeviceOrientationEvent === "undefined") {
        setSupported(false);
        return;
      }
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
          const perm = await DeviceOrientationEvent.requestPermission();
          if (perm !== "granted") {
            setSupported(false);
            return;
          }
        } catch {
          setSupported(false);
          return;
        }
      }
      window.addEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true,
      );
      window.addEventListener("deviceorientation", handleOrientation, true);
    };
    setup();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true,
      );
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  return { heading, supported };
}
