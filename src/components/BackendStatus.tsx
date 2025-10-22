import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'

export const BackendStatus: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [message, setMessage] = useState('')

  interface HealthCheckResponse {
    status: string
    uptime?: number
    // add more fields as needed
    error?: string
  }

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const result = await api.get<HealthCheckResponse>('/health')
        
        if (result.error) {
          setStatus('offline')
          setMessage(result.error)
        } else {
          setStatus('online')
          setMessage('Backend is running and connected')
        }
      } catch (error) {
        setStatus('offline')
        setMessage('Cannot connect to backend - check console for details')
      }
    }

    checkBackend()
  }, [])

  return (
    <div className={`text-sm p-3 rounded border ${
      status === 'online' ? 'bg-green-50 border-green-200 text-green-800' :
      status === 'offline' ? 'bg-red-50 border-red-200 text-red-800' :
      'bg-yellow-50 border-yellow-200 text-yellow-800'
    }`}>
      <strong>Backend Status:</strong> {status.toUpperCase()} 
      {message && <span className="ml-2">- {message}</span>}
    </div>
  )
}