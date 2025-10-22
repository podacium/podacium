const testBackend = async () => {
  try {
    const baseUrl = 'http://localhost:8000'
    
    console.log('🧪 Testing backend connection...')
    const healthResponse = await fetch(`${baseUrl}/`)
    console.log('Health check status:', healthResponse.status)
    
    // Test with /api prefix
    console.log('\n🧪 Testing auth endpoints with /api prefix...')
    
    const testData = {
      fullName: "Test User",
      email: "test@example.com",
      password: "testpassword123",
      provider: "EMAIL",
      acceptedTerms: true,
      subscribeNewsletter: false
    }
    
    // Try with /api prefix
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })
    
    console.log('Register endpoint status:', registerResponse.status)
    console.log('Register endpoint OK:', registerResponse.ok)
    
    if (!registerResponse.ok) {
      const errorText = await registerResponse.text()
      console.log('Error response:', errorText)
      
      // Also test what routes are available
      console.log('\n🧪 Checking available routes...')
      const routesResponse = await fetch(`${baseUrl}/routes`)
      if (routesResponse.ok) {
        const routes = await routesResponse.json()
        console.log('Available routes:', routes)
      }
    } else {
      const result = await registerResponse.json()
      console.log('Success response:', result)
    }
    
  } catch (error) {
    console.error('❌ Backend test failed:', error.message)
  }
}

testBackend()