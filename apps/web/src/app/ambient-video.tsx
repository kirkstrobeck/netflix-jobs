"use client";

import { useEffect, useRef } from "react";

export function AmbientVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    // The ref is always attached by the time the effect runs; the guard exists
    // to narrow the type, so there is no way to exercise it.
    /* v8 ignore next 3 */
    if (!video) {
      return;
    }

    video.loop = true;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const play = () => {
      video.play().catch(() => {
        // Autoplay can still be refused; the poster remains visible.
      });
    };

    const syncPlayback = () => {
      if (motion.matches) {
        video.pause();
        return;
      }

      play();
    };

    const restart = () => {
      if (motion.matches) {
        return;
      }

      video.currentTime = 0;
      play();
    };

    syncPlayback();
    motion.addEventListener("change", syncPlayback);
    video.addEventListener("ended", restart);

    return () => {
      motion.removeEventListener("change", syncPlayback);
      video.removeEventListener("ended", restart);
    };
  }, []);

  // Filenames carry a content hash: these are served immutable for a year, so
  // re-encoding an asset requires a new hash or returning visitors keep the old file.
  return (
    <video
      aria-hidden="true"
      className="absolute inset-0 size-full object-fill"
      loop
      muted
      playsInline
      poster="/video/ambient-light-poster.dc7199e6.jpg"
      preload="none"
      ref={videoRef}
      tabIndex={-1}
    >
      <source
        src="/video/ambient-light-footer.15f477f8.webm"
        type="video/webm"
      />
      <source src="/video/ambient-light-footer.fa761cec.mp4" type="video/mp4" />
    </video>
  );
}
