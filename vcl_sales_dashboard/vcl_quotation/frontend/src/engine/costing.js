// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — COSTING ENGINE
// All functions accept a `rates` object from CostingContext.
// This means changes on the Costing page take effect immediately.
// ─────────────────────────────────────────────────────────────────────────────
import { FLUTE_TYPES, PLY_LAYERS } from '../data/masterData.js'

// ── GSM-based price scaling ───────────────────────────────────────────────────
function linerPriceFromRates(rates, typeCode, gsm) {
  const baseMap = {
    KRAFT: rates.liner_kraft,
    TEST:  rates.liner_test,
    SEMI:  rates.liner_semi,
    WHITE: rates.liner_white,
  }
  const base = baseMap[typeCode] ?? rates.liner_kraft
  return Math.round(base * (1 + (gsm - 90) * 0.003))
}

function mediumPriceFromRates(rates, gsm) {
  return Math.round(rates.medium_base * (1 + (gsm - 90) * 0.0025))
}

// ── BUILD BOARD from per-part GSM + live rates ────────────────────────────────
export function buildBoard(form, rates) {
  const { ply, fluteCode } = form
  const flute = FLUTE_TYPES.find(f => f.code === fluteCode)
  if (!flute) return null
  const thick = ply === '5' ? flute.thick5 : flute.thick3
  if (thick == null) return null

  const layers = PLY_LAYERS[ply]
  let linerCostPerSqm  = 0
  let mediumCostPerSqm = 0
  let mediumCount      = 0

  layers.forEach(layer => {
    const gsm = Number(form[`gsm_${layer.key}`]) || layer.defaultGSM
    if (layer.role === 'liner') {
      const typeCode      = form[`type_${layer.key}`] || layer.defaultType || 'KRAFT'
      const pricePerTonne = linerPriceFromRates(rates, typeCode, gsm)
      linerCostPerSqm    += (gsm / 1000) * (pricePerTonne / 1000)
    } else {
      const pricePerTonne = mediumPriceFromRates(rates, gsm)
      mediumCostPerSqm   += (gsm / 1000) * flute.factor * (pricePerTonne / 1000)
      mediumCount++
    }
  })

  const starchPerSqm = rates.starch_per_glueline * mediumCount * 2
  const pricePerSqm  = (linerCostPerSqm + mediumCostPerSqm + starchPerSqm) * 1.05

  const topGSM = form.gsm_topLiner || PLY_LAYERS[ply][0].defaultGSM
  const med1GSM = form.gsm_medium1 || PLY_LAYERS[ply][1].defaultGSM
  const botGSM  = form.gsm_botLiner || PLY_LAYERS[ply][PLY_LAYERS[ply].length - 1].defaultGSM

  return {
    name:      `${ply}-Ply ${flute.name} · ${topGSM}/${med1GSM}/${botGSM} GSM`,
    flute:     flute.name,
    fluteCode, ply: `${ply}-Ply`,
    thick,     waste: flute.waste,
    price:     Math.round(pricePerSqm),
  }
}

// ── CARTON COSTING ────────────────────────────────────────────────────────────
export function computeCartonCost({ style, board, dimL, dimW, dimH, qty, inkColours, hasLam, hasDieCut, hasUV, labourType, sellingPrice }, rates) {
  const L=+dimL, W=+dimW, H=+dimH, q=+qty
  if (!style || !board || !L || !W || !H || !q) return null

  const T      = board.thick
  const blankL = style.blankL(L, W, H, T)
  const blankW = style.blankW(L, W, H, T)
  const sqm    = (blankL / 1000) * (blankW / 1000)
  const eff    = rates.efficiency_pct / 100

  const matEach  = sqm * (1 + board.waste / 100) * board.price
  const runHrs   = q / (rates.stitcher_thru * eff)
  const setupHrs = style.setup / 60
  const machEach = ((runHrs + setupHrs) * rates.slotter_rate) / q
  const inkEach  = +inkColours > 0
    ? +inkColours * rates.ink_per_colour + rates.ink_base
    : 0
  const labEach  = labourType === 'piecework'
    ? rates.piecework_rate
    : (rates.labour_hourly * runHrs * 1.2) / q
  const finEach  =
    (hasLam    ? sqm * rates.lamination_per_sqm : 0) +
    (hasDieCut ? rates.diecut_per_pc             : 0) +
    (hasUV     ? sqm * rates.uv_per_sqm          : 0)

  const directEach  = matEach + machEach + inkEach + labEach + finEach
  const ohEach      = directEach * (rates.overhead_pct / 100)
  const fullEach    = directEach + ohEach
  const floorEach   = fullEach / (1 - rates.margin_floor  / 100)
  const targetEach  = fullEach / (1 - rates.margin_target / 100)
  const sp          = +sellingPrice
  const marginPct   = sp > 0 ? ((sp - fullEach) / sp) * 100 : null
  const priceStatus = sp <= 0 ? 'unset' : sp < fullEach ? 'loss' : sp < floorEach ? 'approval' : sp < targetEach ? 'below_target' : 'good'

  return {
    blankLmm: Math.round(blankL), blankWmm: Math.round(blankW),
    blankSqm: sqm.toFixed(4),
    panels:   { L, W, H, T },
    rows: [
      { label:'Board Material',    each:matEach,  tot:matEach*q  },
      { label:'Machine Time',      each:machEach, tot:machEach*q },
      { label:'Ink / Consumables', each:inkEach,  tot:inkEach*q  },
      { label:'Labour',            each:labEach,  tot:labEach*q  },
      { label:'Finishing',         each:finEach,  tot:finEach*q  },
      { label:`Overhead (${rates.overhead_pct}%)`, each:ohEach, tot:ohEach*q },
    ],
    fullEach, fullTot: fullEach * q,
    floorEach, targetEach,
    marginPct, priceStatus,
    approvalRequired: sp > 0 && sp < floorEach,
    unitLabel: 'piece', qtyLabel: 'pieces',
  }
}

// ── SFK COSTING ───────────────────────────────────────────────────────────────
export function computeSFKCost(form, rates) {
  const W = parseFloat(form.sfkWidth)
  const M = parseFloat(form.sfkMetres)
  const q = parseFloat(form.sfkQty)
  if (!W || !M || !q || isNaN(W) || isNaN(M) || isNaN(q)) return null

  // Resolve liner/medium prices from rates
  const linerPriceMap = {
    K90:  rates.sfk_liner_90,
    K120: rates.sfk_liner_120,
    K150: rates.sfk_liner_150,
  }
  const mediumPriceMap = {
    M90:  rates.sfk_medium_90,
    M112: rates.sfk_medium_112,
    M127: rates.sfk_medium_127,
  }
  const fluteFactorMap = { B:1.32, E:1.24, C:1.45 }

  const linerPT  = linerPriceMap[form.sfkLiner]  ?? rates.sfk_liner_120
  const mediumPT = mediumPriceMap[form.sfkMedium] ?? rates.sfk_medium_112
  const factor   = fluteFactorMap[form.sfkFlute]  ?? 1.32

  // GSM from the liner/medium codes
  const linerGSMMap  = { K90:90,  K120:120, K150:150 }
  const mediumGSMMap = { M90:90,  M112:112, M127:127 }
  const linerGSM  = linerGSMMap[form.sfkLiner]  ?? 120
  const mediumGSM = mediumGSMMap[form.sfkMedium] ?? 112

  const sqmPerReel = (W / 1000) * M
  if (sqmPerReel <= 0) return null

  const linerKg    = sqmPerReel * (linerGSM  / 1000)
  const mediumKg   = sqmPerReel * (mediumGSM / 1000) * factor
  const linerCost  = linerKg  * (linerPT  / 1000)
  const mediumCost = mediumKg * (mediumPT / 1000)
  const starchCost = sqmPerReel * rates.sfk_starch_per_sqm
  const matPerReel = linerCost + mediumCost + starchCost

  const eff        = rates.efficiency_pct / 100
  const runHrs     = (sqmPerReel * q) / (rates.sfk_corr_thru_sqm * eff)
  const machTotal  = (runHrs + rates.sfk_setup_hrs) * rates.corrugator_rate
  const machPerReel = machTotal / q
  const labPerReel  = (runHrs * rates.labour_hourly) / q

  const directPerReel = matPerReel + machPerReel + labPerReel
  const ohPerReel     = directPerReel * (rates.overhead_pct / 100)
  const fullPerReel   = directPerReel + ohPerReel
  const floorPerReel  = fullPerReel / (1 - rates.margin_floor  / 100)
  const targetPerReel = fullPerReel / (1 - rates.margin_target / 100)

  const sp        = parseFloat(form.sfkSellingPrice) || 0
  const marginPct = sp > 0 ? ((sp - fullPerReel) / sp) * 100 : null
  const priceStatus = sp <= 0 ? 'unset' : sp < fullPerReel ? 'loss' : sp < floorPerReel ? 'approval' : sp < targetPerReel ? 'below_target' : 'good'

  return {
    sqmPerReel: sqmPerReel.toFixed(2),
    linerKg:    linerKg.toFixed(2),
    mediumKg:   mediumKg.toFixed(2),
    rows: [
      { label:'Kraft Liner',                        each:linerCost,   tot:linerCost*q   },
      { label:'Fluting Medium',                     each:mediumCost,  tot:mediumCost*q  },
      { label:'Starch / Adhesive',                  each:starchCost,  tot:starchCost*q  },
      { label:'Corrugator Time',                    each:machPerReel, tot:machTotal      },
      { label:'Labour',                             each:labPerReel,  tot:labPerReel*q  },
      { label:`Overhead (${rates.overhead_pct}%)`,  each:ohPerReel,   tot:ohPerReel*q   },
    ],
    fullEach:  fullPerReel, fullTot: fullPerReel * q,
    floorEach: floorPerReel, targetEach: targetPerReel,
    marginPct, priceStatus,
    approvalRequired: sp > 0 && sp < floorPerReel,
    unitLabel: 'reel', qtyLabel: 'reels',
  }
}

// ── SIMPLE CHECK (Excel model cross-reference) ────────────────────────────────
// Finished-board blended KG price × weight per piece + waste + flat labour.
// Returns cost price and target price only — no approval logic.
// Matched to the VCL Excel costing model for comparison / model calibration.
export function computeSimpleCheck({ blankLmm, blankWmm, inkColours, ply }, rates) {
  if (!blankLmm || !blankWmm) return null

  // Blank area in m²
  const areaSqm = (blankLmm / 1000) * (blankWmm / 1000)

  // Pick the blended KG price — default to TL for 3-ply, TL 5-ply for 5-ply
  // (user can refine by selecting board type in future; for now use the base TL rate)
  const kgPrice = ply === '5' ? rates.sc_kg_tl_5ply : rates.sc_kg_tl

  // Weight per piece from blank area × blended KG/m²
  // The Excel uses: blank area × (total GSM / 1000) but since kgPrice is per KG
  // of finished board, we need weight. We approximate from area at ~437.5 GSM total
  // (3 × 125 GSM + fluting take-up ≈ 437.5). This is calibrated in the SC rates.
  // For the Simple Check the weight is derived from board density assumption:
  // a standard 3-ply B-flute 125/125/125 board weighs ~0.38 kg/m².
  // Rather than re-deriving GSM here, we use the area × kgPrice directly
  // since the Excel kgPrice already encodes density (it's KES per KG of BOARD,
  // and board KG = area × board_density). So the Excel formula is:
  //   paper_cost = wt_per_pc × kg_price
  //   wt_per_pc  = area × total_gsm / 1000
  // We keep area and let the user see both numbers.

  // We can't access layer GSMs here easily, so we expose cost per KG for the
  // panel note, and the panel computes wt from the main cost result.
  return { areaSqm, kgPrice }
}

// Compute Simple Check cost and target given weight-per-pc (from detailed model)
export function simpleCheckFromWeight({ wtKgPerPc, areaSqm, inkColours, ply }, rates) {
  if (!wtKgPerPc || wtKgPerPc <= 0) return null

  const kgPrice   = ply === '5' ? rates.sc_kg_tl_5ply : rates.sc_kg_tl
  const paperCost = wtKgPerPc * kgPrice
  const wasteCost = paperCost * (rates.sc_waste_pct / 100)
  const costPrice = paperCost + wasteCost + rates.sc_labour_per_pc

  const colours   = Math.min(Math.max(parseInt(inkColours) || 0, 0), 6)
  const marginKey = `sc_margin_${colours}col`
  const marginPct = rates[marginKey] ?? 20
  const targetPrice = costPrice / (1 - marginPct / 100)

  return {
    kgPrice,
    paperCost,
    wasteCost,
    labourPc:    rates.sc_labour_per_pc,
    costPrice,
    targetPrice,
    marginPct,
    wtKgPerPc,
  }
}
