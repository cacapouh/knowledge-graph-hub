import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Datasets from './pages/Datasets'
import OntologyPage from './pages/OntologyPage'
import ObjectExplorer from './pages/ObjectExplorer'
import Pipelines from './pages/Pipelines'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/datasets" element={<Datasets />} />
        <Route path="/ontology" element={<OntologyPage />} />
        <Route path="/ontology/explorer/:objectTypeId" element={<ObjectExplorer />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
