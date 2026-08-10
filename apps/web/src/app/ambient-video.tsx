"use client";

import { useEffect, useRef } from "react";

// The playback wiring, taking the element rather than reading a ref, so that
// "there is no element" is an argument a test can pass rather than a state only
// React can produce. Returns the teardown, or nothing when there was nothing to
// wire up.
export function drivePlayback(
  video: HTMLVideoElement | null,
): (() => void) | undefined {
  if (!video) {
    return undefined;
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
}

export function AmbientVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => drivePlayback(videoRef.current), []);

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
