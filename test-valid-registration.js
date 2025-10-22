const testValidRegistration = async () => {
  try {
    const baseUrl = 'http://localhost:8000'
    
    console.log('🧪 Testing registration with valid data...\n')
    
    const validData = {
      fullName: "John Doe",
      email: "john.doe@example.com",
      password: "SecurePassword123!",
      provider: "EMAIL",
      role: "STUDENT",
      acceptedTerms: true,
      subscribeNewsletter: false
    }
    
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData),
    })
    
    console.log('Response Status:', response.status)
    console.log('Response OK:', response.ok)
    
    const responseData = await response.json()
    console.log('Response Data:', JSON.stringify(responseData, null, 2))
    
    if (!response.ok) {
      console.log('\n❌ Registration failed. Validation errors:')
      if (responseData.detail) {
        // Handle FastAPI validation errors
        if (Array.isArray(responseData.detail)) {
          responseData.detail.forEach(error => {
            console.log(`- ${error.loc.join('.')}: ${error.msg}`)
          })
        } else {
          console.log(`- ${responseData.detail}`)
        }
      }
    } else {
      console.log('\n✅ Registration successful!')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testValidRegistration()