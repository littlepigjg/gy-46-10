import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import UrlList from './pages/UrlList.jsx'
import ScreenshotTimeline from './pages/ScreenshotTimeline.jsx'
import TagManager from './pages/TagManager.jsx'
import ScreenshotBrowser from './pages/ScreenshotBrowser.jsx'

function NavLink({ to, children }) {
  const location = useLocation()
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))

  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  )
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold text-gray-900">
                  网页截图归档工具
                </h1>
                <nav className="flex items-center gap-1">
                  <NavLink to="/">URL管理</NavLink>
                  <NavLink to="/browser">截图浏览</NavLink>
                  <NavLink to="/tags">标签管理</NavLink>
                </nav>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<UrlList />} />
            <Route path="/url/:id" element={<ScreenshotTimeline />} />
            <Route path="/browser" element={<ScreenshotBrowser />} />
            <Route path="/tags" element={<TagManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
