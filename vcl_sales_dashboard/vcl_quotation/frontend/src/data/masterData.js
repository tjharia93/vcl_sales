// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION SYSTEM — MASTER DATA  (update prices here before go-live)
// ─────────────────────────────────────────────────────────────────────────────

export const OVERHEAD_PCT    = 18
export const MARGIN_FLOOR    = 15
export const MARGIN_TARGET   = 25
export const CORRUGATOR_RATE = 1800
export const SLOTTER_RATE    = 1200
export const STITCHER_RATE   = 750
export const STITCHER_THRU   = 1500
export const EFFICIENCY      = 0.85
export const LABOUR_HOURLY   = 650
export const PIECEWORK_RATE  = 1.20
export const STARCH_PER_GLUELINE = 0.025

// ── CARTON STYLES ────────────────────────────────────────────────────────────
export const CARTON_STYLES = [
  { code:'RSC',         name:'Regular Slotted Carton (RSC)',   cat:'Regular Slotted', fefco:'0201', blankL:(l,w,h,t)=>2*(l+w)+40+2*t,  blankW:(l,w,h,t)=>2*h+w/2+20,    join:'Stitched', setup:30 },
  { code:'HSC',         name:'Half Slotted Container (HSC)',   cat:'Regular Slotted', fefco:'0200', blankL:(l,w,h,t)=>2*(l+w)+40+2*t,  blankW:(l,w,h,t)=>h+w/2+20,      join:'Stitched', setup:30 },
  { code:'FOL',         name:'Full Overlap Slotted (FOL)',     cat:'Regular Slotted', fefco:'0203', blankL:(l,w,h,t)=>2*(l+w)+40+2*t,  blankW:(l,w,h,t)=>l+2*h+w/2+20,  join:'Stitched', setup:30 },
  { code:'OSC',         name:'Overlap Slotted (OSC)',          cat:'Regular Slotted', fefco:'0202', blankL:(l,w,h,t)=>2*(l+w)+40+2*t,  blankW:(l,w,h,t)=>2*h+w/2+25,    join:'Stitched', setup:30 },
  { code:'2RSC',        name:'Double-Wall RSC (2RSC)',         cat:'Regular Slotted', fefco:'0201', blankL:(l,w,h,t)=>2*(l+w)+50+2*t,  blankW:(l,w,h,t)=>2*h+w/2+30,    join:'Stitched', setup:35 },
  { code:'3RSC',        name:'Triple-Wall RSC (3RSC)',         cat:'Regular Slotted', fefco:'0201', blankL:(l,w,h,t)=>2*(l+w)+55+3*t,  blankW:(l,w,h,t)=>2*h+w/2+35,    join:'Stitched', setup:40 },
  { code:'FLAT_TRAY',   name:'Flat Tray — No Flap',           cat:'Tray',            fefco:'0711', blankL:(l,w,h,t)=>l+2*h+2*t+20,    blankW:(l,w,h,t)=>w+2*h+2*t+20,  join:'Stitched', setup:25 },
  { code:'1FLAP_TRAY',  name:'1-Flap Tray',                   cat:'Tray',            fefco:'0712', blankL:(l,w,h,t)=>l+2*h+2*t+25,    blankW:(l,w,h,t)=>w+2*h+2*t+30,  join:'Stitched', setup:30 },
  { code:'2FLAP_TRAY',  name:'2-Flap Tray',                   cat:'Tray',            fefco:'0713', blankL:(l,w,h,t)=>l+2*h+2*t+30,    blankW:(l,w,h,t)=>w+2*h+2*t+35,  join:'Stitched', setup:35 },
  { code:'BLISS',       name:'Bliss Box — 3-Piece Tray',      cat:'Tray',            fefco:'0770', blankL:(l,w,h,t)=>l+2*t+10,         blankW:(l,w,h,t)=>w+2*h+2*t+30,  join:'Stitched', setup:50 },
  { code:'TELE_BASE',   name:'Telescope Base',                 cat:'Telescope',       fefco:'0310', blankL:(l,w,h,t)=>2*(l+w)+40+2*t,  blankW:(l,w,h,t)=>h+w/2+20,      join:'Stitched', setup:30 },
  { code:'TELE_LID',    name:'Telescope Lid',                  cat:'Telescope',       fefco:'0310', blankL:(l,w,h,t)=>2*(l+w+10)+40,   blankW:(l,w,h,t)=>h*0.4+w/2+20,  join:'Stitched', setup:25 },
  { code:'WRAPAROUND',  name:'Wrap-Around Blank',              cat:'Folder',          fefco:'0500', blankL:(l,w,h,t)=>2*l+2*w+30,      blankW:(l,w,h,t)=>h+w+25,        join:'None',     setup:20 },
  { code:'FOLDER',      name:'Folder / Corrugated Pad',        cat:'Folder',          fefco:'0500', blankL:(l,w,h,t)=>2*l+10,           blankW:(l,w,h,t)=>w+10,          join:'None',     setup:15 },
  { code:'CRASH_LOCK',  name:'Crash-Lock Bottom',              cat:'Die-Cut',         fefco:'0427', blankL:(l,w,h,t)=>2*(l+w)+45+2*t,  blankW:(l,w,h,t)=>2*h+w+30,      join:'Glued',    setup:60 },
  { code:'DIECUT',      name:'Die-Cut Special / Custom',       cat:'Die-Cut',         fefco:'—',    blankL:(l,w,h,t)=>l+2*h+2*t+40,    blankW:(l,w,h,t)=>w+2*h+2*t+40,  join:'Glued',    setup:60 },
  { code:'PLAIN_SHEET', name:'Plain Corrugated Sheet',         cat:'Sheet Goods',     fefco:'—',    blankL:(l,w,h,t)=>l,                blankW:(l,w,h,t)=>w,              join:'None',     setup:10 },
  { code:'SCORED_SHEET',name:'Scored / Creased Sheet',         cat:'Sheet Goods',     fefco:'—',    blankL:(l,w,h,t)=>l,                blankW:(l,w,h,t)=>w,              join:'None',     setup:15 },
]

export const STYLE_GROUPS = CARTON_STYLES.reduce((acc, s) => {
  if (!acc[s.cat]) acc[s.cat] = []
  acc[s.cat].push(s)
  return acc
}, {})

// ── LINER TYPES ───────────────────────────────────────────────────────────────
export const LINER_TYPES = [
  { code:'KRAFT', name:'Kraft (Virgin)',  desc:'Premium strength, brown. Best for export.',   priceBase:72000 },
  { code:'TEST',  name:'Test Liner',      desc:'Recycled fibre, grey. Standard domestic.',    priceBase:52000 },
  { code:'SEMI',  name:'Semi-Chemical',   desc:'Mixed fibre. Standard corrugated board.',     priceBase:60000 },
  { code:'WHITE', name:'White-Top Kraft', desc:'Printable white surface.',                    priceBase:80000 },
]

// GSM options available for manual entry (liners and mediums share the same list)
export const GSM_OPTIONS = [60,75,80,90,100,110,112,120,127,140,150,175,200]

export function linerPrice(typeCode, gsm) {
  const type = LINER_TYPES.find(t => t.code === typeCode)
  const base = type ? type.priceBase : 65000
  return Math.round(base * (1 + (gsm - 90) * 0.003))
}

export function mediumPrice(gsm) {
  return Math.round(55000 * (1 + (gsm - 90) * 0.0025))
}

// ── PLY LAYER DEFINITIONS ─────────────────────────────────────────────────────
// Defines which layers exist per ply, their role, and default GSM + type
export const PLY_LAYERS = {
  '3': [
    { key:'topLiner', label:'Top Liner (Outer)',   role:'liner',  defaultGSM:120, defaultType:'KRAFT' },
    { key:'medium1',  label:'Fluting Medium',       role:'medium', defaultGSM:112, defaultType:null    },
    { key:'botLiner', label:'Bottom Liner (Inner)', role:'liner',  defaultGSM:120, defaultType:'KRAFT' },
  ],
  '5': [
    { key:'topLiner', label:'Top Liner (Outer)',   role:'liner',  defaultGSM:150, defaultType:'KRAFT' },
    { key:'medium1',  label:'Fluting Medium 1',    role:'medium', defaultGSM:127, defaultType:null    },
    { key:'midLiner', label:'Centre Liner',         role:'liner',  defaultGSM:120, defaultType:'SEMI'  },
    { key:'medium2',  label:'Fluting Medium 2',    role:'medium', defaultGSM:127, defaultType:null    },
    { key:'botLiner', label:'Bottom Liner (Inner)', role:'liner',  defaultGSM:150, defaultType:'KRAFT' },
  ],
}

// Build default layer GSM/type values for a given ply (used in BLANK_FORM)
export function defaultLayers(ply) {
  const layers = {}
  PLY_LAYERS[ply].forEach(l => {
    layers[`gsm_${l.key}`]  = l.defaultGSM
    if (l.role === 'liner') layers[`type_${l.key}`] = l.defaultType
  })
  return layers
}

// ── FLUTE TYPES ───────────────────────────────────────────────────────────────
export const FLUTE_TYPES = [
  { code:'B',  name:'B Flute',        factor:1.32, thick3:3.0,  thick5:6.0,  waste:7, desc:'Most common. Good compression. Standard for most cartons.' },
  { code:'C',  name:'C Flute',        factor:1.45, thick3:4.0,  thick5:7.5,  waste:7, desc:'Thicker than B. Better cushioning for fragile items.' },
  { code:'E',  name:'E Flute',        factor:1.24, thick3:1.5,  thick5:3.5,  waste:9, desc:'Micro flute. Smooth surface, good printability.' },
  { code:'BC', name:'BC Double Wall', factor:1.38, thick3:null, thick5:6.0,  waste:8, desc:'5-Ply only. Maximum strength. Heavy export / industrial.' },
  { code:'EB', name:'EB Double Wall', factor:1.34, thick3:null, thick5:5.5,  waste:8, desc:'5-Ply only. Heavy goods with print requirement.' },
]

// ── SFK DATA ──────────────────────────────────────────────────────────────────
export const SFK_LINERS = [
  { code:'K90',  name:'90 GSM Kraft',  gsm:90,  pricePerTonne:68000 },
  { code:'K120', name:'120 GSM Kraft', gsm:120, pricePerTonne:72000 },
  { code:'K150', name:'150 GSM Kraft', gsm:150, pricePerTonne:75000 },
]
export const SFK_MEDIUMS = [
  { code:'M90',  name:'90 GSM Medium',  gsm:90,  pricePerTonne:58000 },
  { code:'M112', name:'112 GSM Medium', gsm:112, pricePerTonne:60000 },
  { code:'M127', name:'127 GSM Medium', gsm:127, pricePerTonne:62000 },
]
export const SFK_FLUTES = [
  { code:'B', name:'B Flute', factor:1.32 },
  { code:'E', name:'E Flute', factor:1.24 },
  { code:'C', name:'C Flute', factor:1.45 },
]

// ── STYLE HELPERS ─────────────────────────────────────────────────────────────
export const STYLE_HELPERS = {
  RSC:         { title:'Regular Slotted Carton',    fefco:'FEFCO 0201', uses:['General shipping & storage','FMCG secondary packaging','Export cartons'],           blankNote:'Blank L = 2×(L+W)+40+2T. Blank W = 2×H+W÷2+20. Four flaps top and bottom meet at centre.',                     sizeImpact:'Height drives blank width. Standard flap depth = W÷2. H is the biggest cost driver.',            stations:['Corrugator','Slotter/Scorer','Stitcher'],                    complexity:'Low',        diagram:'rsc'        },
  HSC:         { title:'Half Slotted Container',    fefco:'FEFCO 0200', uses:['Open-top display trays','Telescope base','Cold-room storage'],                      blankNote:'No top flaps. Blank W ≈ H+W÷2. Needs a matching lid quoted separately.',                                     sizeImpact:'Shorter blank width than RSC for same H. Top open — customer fits lid.',                         stations:['Corrugator','Slotter/Scorer','Stitcher'],                    complexity:'Low',        diagram:'hsc'        },
  FOL:         { title:'Full Overlap Slotted',      fefco:'FEFCO 0203', uses:['Heavy contents','Agricultural export','Extra base strength'],                       blankNote:'Top flaps = full L dimension, fully overlapping. Blank W ≈ L+2×H+W÷2.',                                      sizeImpact:'Largest blank width. Cost premium is material not labour.',                                       stations:['Corrugator','Slotter/Scorer','Stitcher'],                    complexity:'Low–Medium', diagram:'fol'        },
  OSC:         { title:'Overlap Slotted Container', fefco:'FEFCO 0202', uses:['Medium-weight goods','Partial top protection'],                                     blankNote:'Flaps extend past centre but do not fully meet.',                                                           sizeImpact:'Intermediate blank and material cost.',                                                           stations:['Corrugator','Slotter/Scorer','Stitcher'],                    complexity:'Low',        diagram:'osc'        },
  '2RSC':      { title:'Double-Wall RSC',           fefco:'FEFCO 0201', uses:['Heavy machinery','Dense export','Long-distance shipping'],                          blankNote:'Same geometry as RSC. Uses 5-ply double-wall board. Thickness ~6mm adds to blank.',                       sizeImpact:'~6mm extra on both blank dims. Blank weight 1.6× RSC. Requires 5-ply.',                         stations:['Corrugator (double-backer)','Slotter/Scorer','Stitcher'],    complexity:'Medium',     diagram:'rsc'        },
  '3RSC':      { title:'Triple-Wall RSC',           fefco:'FEFCO 0201', uses:['Bulk industrial','Pallet containers','Hazmat outer'],                               blankNote:'7-ply board. Thickness 8–10mm. Check corrugator max width.',                                               sizeImpact:'~18–20mm added to blank. Verify machine width limits.',                                          stations:['Corrugator (triple pass)','Slotter/Scorer','Stitcher'],      complexity:'High',       diagram:'rsc'        },
  FLAT_TRAY:   { title:'Flat Tray — No Flap',      fefco:'FEFCO 0711', uses:['Flower farm export','Produce display','Shelf-ready packaging'],                     blankNote:'Cross-shaped blank: L+2H length, W+2H width. Corners stitched — no flaps fold over.',                  sizeImpact:'H (depth) most expensive — each 10mm adds 20mm to both blank dims.',                            stations:['Corrugator','Guillotine','Stitcher (corners)'],              complexity:'Low',        diagram:'flat_tray'  },
  '1FLAP_TRAY':{ title:'1-Flap Tray',              fefco:'FEFCO 0712', uses:['Bakery trays','One-side display','3-side ventilation'],                             blankNote:'One long side has folded flap for rigidity. Adds ~30mm to blank width vs flat tray.',                  sizeImpact:'Flap on one long side only.',                                                                     stations:['Corrugator','Guillotine','Slotter/Scorer','Stitcher'],       complexity:'Low–Medium', diagram:'one_flap'   },
  '2FLAP_TRAY':{ title:'2-Flap Tray',              fefco:'FEFCO 0713', uses:['Mango / avocado export','Flower farm trays','Stacking'],                            blankNote:'Both long sides have flaps. Blank W ≈ W+2H+35mm. Strongest open tray.',                                sizeImpact:'Two flaps add ~35mm to blank width. Best stacking strength.',                                    stations:['Corrugator','Guillotine','Slotter/Scorer','Stitcher'],       complexity:'Medium',     diagram:'two_flap'   },
  BLISS:       { title:'Bliss Box — 3-Piece Tray', fefco:'FEFCO 0770', uses:['Very large trays','High stacking loads','Exceeds corrugator width'],                 blankNote:'Three pieces: base panel + two end pieces stitched.',                                                      sizeImpact:'Base blank = L×W only. End panels quoted separately.',                                           stations:['Corrugator','Guillotine','Stitcher (assembly)'],             complexity:'High',       diagram:'bliss'      },
  TELE_BASE:   { title:'Telescope Base',            fefco:'FEFCO 0310', uses:['Premium gift boxes','File storage','Archive'],                                      blankNote:'Open-top base. Quote with TELE_LID for complete set.',                                                     sizeImpact:'Lid adds 10–15mm to L and W — always quote as a pair.',                                         stations:['Corrugator','Slotter/Scorer','Stitcher'],                    complexity:'Low',        diagram:'tele_base'  },
  TELE_LID:    { title:'Telescope Lid',             fefco:'FEFCO 0310', uses:['Lid for telescope base','Document boxes','Gift packaging'],                         blankNote:'Lid = Base L+10 × W+10 × 30–50mm deep.',                                                                  sizeImpact:'Shallow blank — 20–40% of base height.',                                                         stations:['Corrugator','Slotter/Scorer','Stitcher'],                    complexity:'Low',        diagram:'tele_lid'   },
  WRAPAROUND:  { title:'Wrap-Around Blank',         fefco:'FEFCO 0500', uses:['Beverage multipacks','FMCG machine-applied','Secondary packaging'],                 blankNote:'Flat blank wraps around product. No stitching. Blank = 2L+2W.',                                           sizeImpact:'H = product height. No join — very efficient board use.',                                        stations:['Corrugator','Guillotine','Scorer'],                          complexity:'Low',        diagram:'wraparound' },
  FOLDER:      { title:'Corrugated Pad / Folder',  fefco:'FEFCO 0500', uses:['Layer pads','Void fill dividers','Corner protectors'],                              blankNote:'Flat scored sheet. Blank = L×W exactly.',                                                                  sizeImpact:'L and W are direct blank dims. Fastest and cheapest.',                                           stations:['Corrugator','Guillotine'],                                   complexity:'Very Low',   diagram:'folder'     },
  CRASH_LOCK:  { title:'Crash-Lock Bottom',         fefco:'FEFCO 0427', uses:['Retail display boxes','Snap-open packaging','Gift'],                                blankNote:'Pre-glued bottom snaps open. Requires die-cut.',                                                           sizeImpact:'Bottom adds blank depth. Custom die KES 15–40K.',                                               stations:['Corrugator','Die-Cutter','Gluer'],                           complexity:'High',       diagram:'crash_lock' },
  DIECUT:      { title:'Die-Cut Special / Custom',  fefco:'Custom',     uses:['POS displays','Custom shapes','Promotional'],                                       blankNote:'Fully custom shape. Blank = bounding box. Custom die required.',                                          sizeImpact:'Complex shapes have high offal. Add tooling as separate line.',                                  stations:['Corrugator','Die-Cutter','Gluer or Stitcher'],               complexity:'Very High',  diagram:'diecut'     },
  PLAIN_SHEET: { title:'Plain Corrugated Sheet',    fefco:'—',          uses:['Sold to converters','Layer pads','Void fill'],                                      blankNote:'No conversion. Cut to size only.',                                                                         sizeImpact:'L and W are sheet dims. Guillotine trim only waste.',                                            stations:['Corrugator','Guillotine'],                                   complexity:'Very Low',   diagram:'plain'      },
  SCORED_SHEET:{ title:'Scored / Creased Sheet',    fefco:'—',          uses:['Customer self-assembly','Book wraps','Archive blanks'],                             blankNote:'Flat sheet with crease lines added.',                                                                      sizeImpact:'Same blank as plain sheet. Score positions must be specified.',                                  stations:['Corrugator','Guillotine','Scorer'],                          complexity:'Very Low',   diagram:'scored'     },
}

export const COMPLEXITY_COLORS = {
  'Very Low':'#15803d','Low':'#0369a1','Low–Medium':'#0369a1',
  'Medium':'#92400e','High':'#b91c1c','Very High':'#b91c1c',
}

export const STATUS_CONFIG = {
  loss:         { label:'LOSS — CFO Required',    bg:'#fef2f2', border:'#ef4444', text:'#b91c1c', dot:'#ef4444' },
  approval:     { label:'Below Floor — Approval', bg:'#fffbeb', border:'#f59e0b', text:'#92400e', dot:'#f59e0b' },
  below_target: { label:'Below Target Margin',    bg:'#f0f9ff', border:'#0ea5e9', text:'#0369a1', dot:'#0ea5e9' },
  good:         { label:'Within Target',          bg:'#f0fdf4', border:'#22c55e', text:'#15803d', dot:'#22c55e' },
  unset:        { label:'Price Not Set',          bg:'#f8fafc', border:'#cbd5e1', text:'#64748b', dot:'#94a3b8' },
}
