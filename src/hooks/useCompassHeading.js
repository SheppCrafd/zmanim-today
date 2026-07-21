import { useState, useEffect, useRef, useCallback } from "react";

export function useCompassHeading() {
  const [heading, setHeading] = useState(0);
  const [supported, setSupported] = useState(true);
  const smoothRef = useRef(0);
  const frameRef = useRef(null);
  const targetRef = useRef(0);

  const handleOrientation = useCallback((e) => {
    let h =
      e.webkitCompassHeading != null
        ? e.webkitCompassHeading
        : e.alpha != null
          ? (360 - e.alpha) % 360
          : null;
    if (h != null) targetRef.current = h;
  }, []);

  useEffect(() => {
    // Smooth interpolation loop
    const animate = () => {
      let diff = targetRef.current - smoothRef.current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      smoothRef.current = smoothRef.current + diff * 0.1;
      // Skip the state update (and the re-render it triggers) when the change
      // since the last render is imperceptibly small. Sensor noise otherwise
      // drives this to re-render ~60x/sec for the entire time the compass is
      // mounted (i.e. most of the time Home is open), even while the device
      // is sitting still. The physics above still integrate every frame, so
      // accuracy is unaffected — only redundant renders are skipped.
      setHeading((prev) =>
        Math.abs(smoothRef.current - prev) < 0.05 ? prev : smoothRef.current,
      );
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

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
  }, [handleOrientation]);

  return { heading, supported };
}
