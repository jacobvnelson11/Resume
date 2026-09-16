import { useRef, useState } from "react";
import type { Job } from "../types";
import { getMatchInfo } from "../utils/match";

const SWIPE_THRESHOLD = 110;

export default function JobCard({
  job,
  active,
  stackOffset = 0,
  onSwipeLeft,
  onSwipeRight,
  forceExit,
}: {
  job: Job;
  active: boolean;
  stackOffset?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Set by the parent's button clicks to animate the same exit a drag would produce. */
  forceExit?: "left" | "right" | null;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const match = getMatchInfo(job.fitScore);

  const effectiveDx = forceExit === "left" ? -600 : forceExit === "right" ? 600 : dx;
  const rotation = effectiveDx / 20;
  const rightHint = Math.min(Math.max(effectiveDx / SWIPE_THRESHOLD, 0), 1);
  const leftHint = Math.min(Math.max(-effectiveDx / SWIPE_THRESHOLD, 0), 1);

  function onPointerDown(e: React.PointerEvent) {
    if (!active) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDx(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dx > SWIPE_THRESHOLD) {
      onSwipeRight();
    } else if (dx < -SWIPE_THRESHOLD) {
      onSwipeLeft();
    } else {
      setDx(0);
    }
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform: `translate(-50%, ${stackOffset * 10}px) translateX(${effectiveDx}px) rotate(${rotation}deg) scale(${1 - stackOffset * 0.04})`,
        transition: dragging ? "none" : "transform 0.35s ease, opacity 0.35s ease",
        opacity: forceExit ? 0 : 1,
        zIndex: 10 - stackOffset,
        touchAction: "pan-y",
      }}
      className="absolute left-1/2 top-0 w-full max-w-xl select-none"
    >
      <div
        className={`bg-white rounded-2xl border shadow-lg p-6 flex flex-col gap-4 cursor-grab active:cursor-grabbing ${
          active ? "" : "pointer-events-none"
        }`}
      >
        {/* Swipe hint stamps */}
        <div
          className="absolute top-6 left-6 border-4 border-emerald-500 text-emerald-500 font-bold text-xl px-3 py-1 rounded-lg -rotate-12"
          style={{ opacity: rightHint }}
        >
          APPLY
        </div>
        <div
          className="absolute top-6 right-6 border-4 border-rose-500 text-rose-500 font-bold text-xl px-3 py-1 rounded-lg rotate-12"
          style={{ opacity: leftHint }}
        >
          SKIP
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-xl text-slate-900 truncate">{job.title}</h3>
            <p className="text-slate-500">{job.company}</p>
          </div>
          <div className={`shrink-0 text-center rounded-full w-20 h-20 flex flex-col items-center justify-center ring-4 ${match.ring} ${match.color}`}>
            <span className="text-xl font-bold leading-none">{job.fitScore}%</span>
            <span className="text-[10px] font-medium leading-none mt-1">match</span>
          </div>
        </div>

        <div className={`text-sm font-medium rounded-md px-3 py-2 ${match.color}`}>{match.label} for your background</div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">Remote</span>
          {job.salaryMin != null && (
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              ${job.salaryMin.toLocaleString()}+ / year
            </span>
          )}
          {job.postedAt && (
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              Posted {new Date(job.postedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-600 line-clamp-5">{job.description}</p>

        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="text-sm text-brand-600 hover:underline self-start"
        >
          Read the full job post ↗
        </a>
      </div>
    </div>
  );
}
