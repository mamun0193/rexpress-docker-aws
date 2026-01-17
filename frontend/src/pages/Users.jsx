import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data.data)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading users...</div>
  }

  if (error) {
    return <div className="error">Error: {error}</div>
  }

  return (
    <div className="users-container">
      <Link to="/" className="back-btn">← Back to Home</Link>
      <h1>User Directory</h1>
      <div className="users-grid">
        {users.map((user) => (
          <div key={user.id} className="user-card">
            <h3>{user.name}</h3>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>ID:</strong> {user.id}</p>
            <span className="role">{user.role}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Users
