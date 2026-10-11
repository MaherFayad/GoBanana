"use client";

/**
 * A row of screen recordings (scroll snap, previous and next buttons). Until the recordings exist
 * each card shows a poster (GoBanana's own generative art) and its caption with "coming soon".
 *
 * When a clip has a `src`, it is a muted, looping <video preload="none"> that plays only while
 * at least 60% of it is on screen, never under prefers-reduced-motion, and has its own pause
 * button (SC 2.2.2). A clip the visitor paused stays paused.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronEndIcon, ChevronStartIcon } from "@/components/studio/icons";
import type { ArtKind } from "@/lib/site/moves";
import { TileArt } from "../TileArt";

export type Clip = { caption: string; art: ArtKind; src?: string; poster?: string };
type Labels = { label: string; prev: string; next: string; play: string; pause: string; soon: string };

function ClipVideo({ src, poster, labels }: { src: string; poster?: string; labels: Labels }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || userPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [userPaused]);

  return (
    <>
      <video
        ref={ref}
        className="clip-video"
        src={src}
        poster={poster}
        preload="none"
        muted
        loop
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className="st-btn clip-toggle"
        data-variant="secondary"
        data-size="sm"
        aria-pressed={!playing}
        onClick={() => {
          const v = ref.current;
          if (!v) return;
          if (v.paused) {
            setUserPaused(false);
            void v.play().catch(() => {});
          } else {
            setUserPaused(true);
            v.pause();
          }
        }}
      >
        {playing ? labels.pause : labels.play}
      </button>
    </>
  );
}

export function ClipSlider({ clips, labels }: { clips: Clip[]; labels: Labels }) {
  const track = useRef<HTMLUListElement>(null);

  function step(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    const smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    el.scrollBy({ left: dir * rtl * el.clientWidth * 0.8, behavior: smooth });
  }

  return (
    <div className="clips">
      <ul ref={track} className="clips-track" aria-label={labels.label} tabIndex={0}>
        {clips.map((clip, i) => (
          <li key={clip.caption} className="clip">
            <figure className="clip-figure">
              <div className="clip-media">
                {clip.src ? (
                  <ClipVideo src={clip.src} poster={clip.poster} labels={labels} />
                ) : (
                  <>
                    <TileArt kind={clip.art} uid={`clip-${i}`} className="clip-poster" />
                    <span className="clip-soon">{labels.soon}</span>
                  </>
                )}
              </div>
              <figcaption className="clip-caption">
                <span className="clip-num" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {clip.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <div className="clips-controls">
        <button type="button" className="st-btn" data-variant="secondary" data-size="md" data-icon-only="" aria-label={labels.prev} onClick={() => step(-1)}>
          <ChevronStartIcon size={16} />
        </button>
        <button type="button" className="st-btn" data-variant="secondary" data-size="md" data-icon-only="" aria-label={labels.next} onClick={() => step(1)}>
          <ChevronEndIcon size={16} />
        </button>
      </div>
    </div>
  );
}
