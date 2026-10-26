import { type CSSProperties, useMemo, useSyncExternalStore } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const reducedMotion = () => window.matchMedia(motionQuery).matches;

const CONFETTI_COLORS = [
  "bg-amber-400",
  "bg-rose-400",
  "bg-sky-400",
  "bg-emerald-400",
  "bg-orange-400",
  "bg-violet-400",
];

// Shared by reading completion and optional quiz celebrations.
export function CompletionConfetti() {
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 64 }, (_, index) => ({
        id: index,
        left: `${Math.random() * 100}%`,
        delay: `${Math.round(Math.random() * 700)}ms`,
        duration: `${2200 + Math.round(Math.random() * 1800)}ms`,
        rotateFrom: `${Math.round((Math.random() * 720) - 360)}deg`,
        rotateTo: `${Math.round((Math.random() * 1440) - 720)}deg`,
        driftX: `${Math.round((Math.random() * 120) - 60)}px`,
        width: `${8 + Math.round(Math.random() * 10)}px`,
        height: `${10 + Math.round(Math.random() * 16)}px`,
        radius: `${2 + Math.round(Math.random() * 10)}px`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [],
  );
  if (reduce) return null;
  return (
        <div className="pointer-events-none fixed inset-0 z-60 overflow-hidden" aria-hidden="true">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className={`confetti-piece ${piece.color}`}
              style={{
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                "--confetti-rotate-from": piece.rotateFrom,
                "--confetti-rotate-to": piece.rotateTo,
                "--confetti-drift-x": piece.driftX,
                "--confetti-width": piece.width,
                "--confetti-height": piece.height,
                "--confetti-radius": piece.radius,
              } as CSSProperties}
            />
          ))}
        </div>
  );
}
