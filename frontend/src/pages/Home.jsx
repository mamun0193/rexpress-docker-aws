import React from 'react'
import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="home-container">
      <h1>Hey, Welcome to Rexpress! 🚀</h1>
      <p>Your full-stack React & Express application</p>
      <Link to="/users" className="btn">
        Click here to see your data
      </Link>
    </div>
  )
}

export default Home
