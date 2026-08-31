/**
 * MTJ ERP — Product-specific attributes by category.
 *
 * A ring needs a size, a chain needs a length, a bangle needs an inner diameter.
 * Capturing these at order time is not cosmetic: they are the dimensions the
 * karigar actually works to, and a job card that omits them sends a piece to the
 * bench that has to come back to be re-sized.
 *
 * Category values are workshop-managed masters (Settings → Dropdowns → Item
 * Category), so matching is by NORMALISED NAME, not by an enum: a workshop that
 * renames "Ring" to "Rings" or adds "Gents Ring" still gets ring fields. A
 * category with no entry here simply shows no extra fields — never an error, and
 * never a blocked order.
 *
 * The captured values live on `OrderItem.attributes` (a free-form
 * Record<string, string>), so adding a field here needs no schema migration and
 * no change to any store.
 */

export interface ProductAttribute {
  /** Stable key stored on OrderItem.attributes — never rename, it's persisted data. */
  key: string;
  label: string;
  placeholder?: string;
  /** Shown under the field; the unit or convention the workshop measures in. */
  hint?: string;
}

/**
 * Matched against the normalised category name (lowercased, letters only).
 * Order matters only for readability — lookup is exact-match on the key first,
 * then a substring match, so "gents ring" and "ladies ring" both resolve to ring.
 */
const ATTRIBUTES_BY_CATEGORY: Record<string, ProductAttribute[]> = {
  ring: [
    { key: "ringSize", label: "Ring Size", placeholder: "e.g. 14", hint: "Indian size" },
    { key: "ringWidthMm", label: "Band Width (mm)", placeholder: "e.g. 3.5" },
  ],
  chain: [
    { key: "chainLengthIn", label: "Chain Length (inches)", placeholder: "e.g. 18" },
    { key: "chainPattern", label: "Chain Pattern", placeholder: "e.g. Rope, Box, Curb" },
    { key: "claspType", label: "Clasp Type", placeholder: "e.g. Lobster, S-hook" },
  ],
  bangle: [
    { key: "bangleSize", label: "Bangle Size", placeholder: "e.g. 2.6" },
    { key: "bangleInnerDiaMm", label: "Inner Diameter (mm)", placeholder: "e.g. 60" },
    { key: "bangleCount", label: "Set Of", placeholder: "e.g. 2 (pair)" },
  ],
  bracelet: [
    { key: "braceletLengthIn", label: "Bracelet Length (inches)", placeholder: "e.g. 7.5" },
    { key: "claspType", label: "Clasp Type", placeholder: "e.g. Box clasp" },
  ],
  necklace: [
    { key: "necklaceLengthIn", label: "Necklace Length (inches)", placeholder: "e.g. 16" },
    { key: "necklacePattern", label: "Pattern / Motif", placeholder: "e.g. Temple, Antique" },
  ],
  mangalsutra: [
    { key: "necklaceLengthIn", label: "Length (inches)", placeholder: "e.g. 18" },
    { key: "blackBeadType", label: "Black Bead Type", placeholder: "e.g. 2-line, 4-line" },
  ],
  earring: [
    { key: "earringType", label: "Earring Type", placeholder: "e.g. Stud, Jhumka, Hoop" },
    { key: "earringBackType", label: "Back Type", placeholder: "e.g. Screw, Push" },
  ],
  pendant: [{ key: "pendantBailMm", label: "Bail Size (mm)", placeholder: "e.g. 4" }],
  nosepin: [{ key: "nosePinFit", label: "Fit", placeholder: "e.g. Screw, Clip, Wire" }],
  anklet: [{ key: "ankletLengthIn", label: "Anklet Length (inches)", placeholder: "e.g. 10" }],
};

function normalise(category: string): string {
  return (category || "").toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * The extra fields to show for a category. Empty array when the category has
 * none — the caller renders nothing, rather than special-casing.
 */
export function attributesForCategory(category: string | undefined | null): ProductAttribute[] {
  const norm = normalise(category ?? "");
  if (!norm) return [];

  // Exact first ("ring" → ring), then containment so a workshop's own naming
  // ("Gents Ring", "Bridal Necklace Set") still resolves.
  if (ATTRIBUTES_BY_CATEGORY[norm]) return ATTRIBUTES_BY_CATEGORY[norm];

  // Longest key wins, so "nosepin" beats a stray "pin"-style match and
  // "mangalsutra" isn't swallowed by a shorter key.
  const hit = Object.keys(ATTRIBUTES_BY_CATEGORY)
    .filter((key) => norm.includes(key))
    .sort((a, b) => b.length - a.length)[0];

  return hit ? ATTRIBUTES_BY_CATEGORY[hit] : [];
}

/** Human-readable "Ring Size: 14 · Band Width: 3.5" for job cards and print. */
export function formatAttributes(
  category: string | undefined | null,
  attributes: Record<string, string> | undefined,
): string {
  if (!attributes) return "";
  const defs = attributesForCategory(category);
  return defs
    .map((d) => {
      const v = attributes[d.key];
      return v ? `${d.label}: ${v}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}
