// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — COSTING DEFAULTS
// These are the factory defaults. Live values are stored in localStorage
// and loaded at startup via the CostingContext.
// ─────────────────────────────────────────────────────────────────────────────

export const COSTING_DEFAULTS = {
  // ── Overhead & Margins ────────────────────────────────────────────────────
  overhead_pct:      18,     // % loaded on direct cost
  margin_floor:      15,     // % — below this requires approval
  margin_target:     25,     // % — target (green zone)

  // ── Machine Rates (KES / hr) ──────────────────────────────────────────────
  corrugator_rate:   1800,
  slotter_rate:      1200,
  stitcher_rate:     750,
  guillotine_rate:   600,
  gluer_rate:        900,
  diecutter_rate:    1400,

  // ── Machine Efficiency & Throughput ───────────────────────────────────────
  efficiency_pct:    85,     // % of rated throughput achieved
  stitcher_thru:     1500,   // pcs / hr at 100% efficiency

  // ── Labour Rates ─────────────────────────────────────────────────────────
  labour_hourly:     650,    // KES / hr (machine operators)
  piecework_rate:    1.20,   // KES / pc

  // ── Materials — Liner (KES / tonne base at 90 GSM) ───────────────────────
  liner_kraft:       72000,
  liner_test:        52000,
  liner_semi:        60000,
  liner_white:       80000,

  // ── Materials — Fluting Medium (KES / tonne base at 90 GSM) ──────────────
  medium_base:       55000,

  // ── Materials — SFK Liners (KES / tonne, exact) ──────────────────────────
  sfk_liner_90:      68000,
  sfk_liner_120:     72000,
  sfk_liner_150:     75000,

  // ── Materials — SFK Mediums (KES / tonne, exact) ─────────────────────────
  sfk_medium_90:     58000,
  sfk_medium_112:    60000,
  sfk_medium_127:    62000,

  // ── Consumables ───────────────────────────────────────────────────────────
  starch_per_glueline: 0.025,  // KES / m² per glue line
  ink_per_colour:      8,      // KES / pc per colour
  ink_base:            5,      // KES / pc fixed when any ink used
  lamination_per_sqm:  55,     // KES / m²
  uv_per_sqm:          40,     // KES / m²
  diecut_per_pc:       12,     // KES / pc
  sfk_starch_per_sqm:  2.50,   // KES / m² for SFK adhesive

  // ── Corrugator SFK throughput ─────────────────────────────────────────────
  sfk_corr_thru_sqm:   1200,   // m² / hr
  sfk_setup_hrs:       0.5,    // hrs per reel run setup

  // ── PIN ───────────────────────────────────────────────────────────────────
  costing_pin:         '1234',

  // ── Simple Check Model (Excel-based, finished board KES/KG) ──────────────
  // Blended KES per KG of finished board by paper type
  sc_kg_tl:            90,    // Test Liner          (TL-TL-TL)
  sc_kg_sm_tl:         100,   // Semi Kraft / TL     (SM-TL-TL)
  sc_kg_wtl:           100,   // White TL            (WTL-TL-TL)
  sc_kg_sm_tl_sm:      110,   // Semi Kraft / SM     (SM-TL-SM)
  sc_kg_full_sm:       120,   // Full Semi Kraft     (SM-SM-SM)
  sc_kg_k_tl:          115,   // Kraft / TL          (K-TL-TL)
  sc_kg_k_tl_k:        140,   // Kraft / TL / K      (K-TL-K)
  sc_kg_full_k:        160,   // Full Kraft          (K-K-K)
  sc_kg_wk:            200,   // White Kraft         (WK-TL-K)
  sc_kg_tl_5ply:       100,   // TL 5-ply
  sc_kg_wtl_5ply:      100,   // WTL 5-ply
  // Labour + stitching flat rate
  sc_labour_per_pc:    8,     // KES / pc
  // Waste loaded on paper cost
  sc_waste_pct:        10,    // %
  // Profit margin by number of colours (used to derive target price)
  sc_margin_0col:      20,
  sc_margin_1col:      25,
  sc_margin_2col:      30,
  sc_margin_3col:      35,
  sc_margin_4col:      40,
  sc_margin_5col:      45,
  sc_margin_6col:      50,
}

export const STORAGE_KEY = 'vcl_costing_rates_v1'

// Load from localStorage, fall back to defaults
export function loadRates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...COSTING_DEFAULTS, ...JSON.parse(stored) }
  } catch {}
  return { ...COSTING_DEFAULTS }
}

// Save to localStorage
export function saveRates(rates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates))
  } catch {}
}
