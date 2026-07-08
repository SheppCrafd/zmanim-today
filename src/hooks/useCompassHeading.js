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
      setHeading(smoothRef.current);
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
