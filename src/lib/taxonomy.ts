export const YEARS = Array.from({ length: 14 }, (_, i) => i); // 0 (New Entrant) – 13

export function yearLabel(y: number, short = false) {
  if (y === 0) return short ? "NE" : "New Entrant";
  return short ? `Y${y}` : `Year ${y}`;
}

/** Compress [1,2,3,5] → "Years 1–3, 5" */
export function formatYears(years: number[]) {
  if (!years?.length) return "All years";
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  for (const y of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && y === last[1] + 1) last[1] = y;
    else ranges.push([y, y]);
  }
  const part = ([a, b]: [number, number]) => {
    const la = a === 0 ? "NE" : String(a);
    return a === b ? la : `${la}–${b}`;
  };
  if (sorted.length === 1) return yearLabel(sorted[0]);
  return `Years ${ranges.map(part).join(", ")}`;
}

export const LEARNING_AREAS = [
  { slug: "english", name: "English", color: "#2f6fb0" },
  { slug: "maths", name: "Maths & Statistics", color: "#c8323a" },
  { slug: "science", name: "Science", color: "#2e8b57" },
  { slug: "social-sciences", name: "Social Sciences", color: "#b7791f" },
  { slug: "te-reo-maori", name: "Te Reo Māori", color: "#8b2f2f" },
  { slug: "the-arts", name: "The Arts", color: "#8e44ad" },
  { slug: "health-pe", name: "Health & PE", color: "#d35400" },
  { slug: "technology", name: "Technology", color: "#16758a" },
  { slug: "languages", name: "Learning Languages", color: "#5b6abf" },
  { slug: "general", name: "General / Cross-curricular", color: "#5f6f66" },
] as const;

export const RESOURCE_TYPES = [
  { slug: "worksheet", name: "Worksheet" },
  { slug: "lesson-plan", name: "Lesson Plan" },
  { slug: "unit-plan", name: "Unit Plan" },
  { slug: "activity", name: "Activity" },
  { slug: "assessment", name: "Assessment" },
  { slug: "rubric", name: "Rubric" },
  { slug: "reading", name: "Reading" },
  { slug: "poster", name: "Poster / Display" },
  { slug: "game", name: "Game" },
  { slug: "planner", name: "Planner / Template" },
] as const;

export function areaBySlug(slug: string) {
  return LEARNING_AREAS.find((a) => a.slug === slug);
}
export function typeBySlug(slug: string) {
  return RESOURCE_TYPES.find((t) => t.slug === slug);
}
