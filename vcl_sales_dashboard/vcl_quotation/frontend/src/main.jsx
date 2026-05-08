import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CostingProvider } from './context/CostingContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CostingProvider>
      <App />
    </CostingProvider>
  </React.StrictMode>
)
