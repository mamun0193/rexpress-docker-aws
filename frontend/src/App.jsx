import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Users from './pages/Users'
import Health from './pages/Health'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/users" element={<Users />} />
          <Route path="/health" element={<Health />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
