const discoverRoutes = async () => {
  const baseUrl = 'http://localhost:8000'
  
  console.log('🔍 Discovering available routes...\n')
  
  // Common auth endpoint patterns
  const testEndpoints = [
    '/auth/register',
    '/api/auth/register',
    '/register',
    '/api/register',
    '/auth/signup',
    '/api/auth/signup',
    '/signup',
    '/api/signup',
    '/users/register',
    '/api/users/register'
  ]
  
  for (const endpoint of testEndpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      })
      console.log(`📍 ${endpoint}: ${response.status} ${response.statusText}`)
    } catch (error) {
      console.log(`📍 ${endpoint}: ERROR - ${error.message}`)
    }
  }
  
  // Check docs
  console.log('\n📖 Visit http://localhost:8000/docs to see all available endpoints')
}

discoverRoutes()