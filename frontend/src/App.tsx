import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import OntologyPage from './pages/OntologyPage'
import ObjectExplorer from './pages/ObjectExplorer'
import GraphView from './pages/GraphView'
import SavedViews from './pages/SavedViews'
import SkillsPage from './pages/SkillsPage'
import GprList from './pages/GprList'
import GprDetail from './pages/GprDetail'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ontology" element={<OntologyPage />} />
        <Route path="/ontology/explorer/:objectTypeId" element={<ObjectExplorer />} />
        <Route path="/graph" element={<GraphView />} />
        <Route path="/views" element={<SavedViews />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/gpr" element={<GprList />} />
        <Route path="/gpr/:id" element={<GprDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
