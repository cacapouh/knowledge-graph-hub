import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import OntologyPage from './pages/OntologyPage'
import ObjectExplorer from './pages/ObjectExplorer'
import GraphView from './pages/GraphView'
import SavedViews from './pages/SavedViews'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ontology" element={<OntologyPage />} />
        <Route path="/ontology/explorer/:objectTypeId" element={<ObjectExplorer />} />
        <Route path="/graph" element={<GraphView />} />
        <Route path="/views" element={<SavedViews />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
