// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — COSTING CONTEXT
// Loads rates from the VCL Costing Settings Single DocType on mount.
// Persists changes back via the whitelisted update_costing_settings method.
// localStorage is kept as an offline cache so a brief network blip does not
// reset the right-panel cost analysis to defaults.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { loadRates, saveRates, COSTING_DEFAULTS } from '../data/costingDefaults.js'
import { apiGetCostingSettings, apiUpdateCostingSettings } from '../api/quotes.js'

const CostingContext = createContext(null)

// Strip out null / empty values so we keep the JS defaults as a backstop
// for any rate that hasn't been configured on the Single DocType yet.
function mergeRemote(remote) {
  const merged = { ...COSTING_DEFAULTS }
  if (!remote || typeof remote !== 'object') return merged
  for (const [k, v] of Object.entries(remote)) {
    if (v !== null && v !== undefined && v !== '') merged[k] = v
  }
  return merged
}

export function CostingProvider({ children }) {
  const [rates, setRates] = useState(loadRates)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const fetched = useRef(false)

  // Hydrate from VCL Costing Settings on first mount.
  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    apiGetCostingSettings()
      .then(data => {
        const merged = mergeRemote(data)
        setRates(merged)
        saveRates(merged)
        setLoaded(true)
      })
      .catch(e => {
        // Fall back to whatever localStorage had (already in state).
        setError(e.message || 'Could not load costing settings')
        setLoaded(true)
      })
  }, [])

  const updateRate = useCallback((key, value) => {
    setRates(prev => {
      const next = { ...prev, [key]: value }
      saveRates(next)
      // Fire and forget; errors surface via setError.
      apiUpdateCostingSettings({ [key]: value }).catch(e => {
        setError(e.message || 'Could not save costing setting')
      })
      return next
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    setRates({ ...COSTING_DEFAULTS })
    saveRates({ ...COSTING_DEFAULTS })
    apiUpdateCostingSettings(COSTING_DEFAULTS).catch(e => {
      setError(e.message || 'Could not reset costing settings')
    })
  }, [])

  return (
    <CostingContext.Provider value={{ rates, updateRate, resetToDefaults, loaded, error }}>
      {children}
    </CostingContext.Provider>
  )
}

export function useCosting() {
  const ctx = useContext(CostingContext)
  if (!ctx) throw new Error('useCosting must be used inside CostingProvider')
  return ctx
}
