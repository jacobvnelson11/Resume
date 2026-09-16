export function getMatchInfo(score: number): { label: string; color: string; ring: string; bar: string } {
  if (score >= 75) {
    return { label: "Great match", color: "text-emerald-700 bg-emerald-100", ring: "ring-emerald-300", bar: "bg-emerald-500" };
  }
  if (score >= 50) {
    return { label: "Good match", color: "text-amber-700 bg-amber-100", ring: "ring-amber-300", bar: "bg-amber-500" };
  }
  return { label: "Possible match", color: "text-slate-600 bg-slate-100", ring: "ring-slate-300", bar: "bg-slate-400" };
}
