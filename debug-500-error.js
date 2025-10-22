const debug500Error = async () => {
  try {
    const baseUrl = 'http://localhost:8000'
    
    console.log('🔧 Debugging 500 Internal Server Error...\n')
    
    const testData = {
      fullName: "John Doe",
      email: "john.doe@example.com",
      password: "SecurePassword123!",
      provider: "EMAIL",
      role: "STUDENT",
      acceptedTerms: true,
      subscribeNewsletter: false
    }
    
    console.log('Sending data:', JSON.stringify(testData, null, 2))
    
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    })
    
    console.log('Response Status:', response.status)
    console.log('Response Status Text:', response.statusText)
    
    // Try to get the response as text first to see what's actually being returned
    const responseText = await response.text()
    console.log('Raw Response:', responseText)
    
    // Then try to parse as JSON if it looks like JSON
    if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
      try {
        const responseJson = JSON.parse(responseText)
        console.log('Parsed JSON:', JSON.stringify(responseJson, null, 2))
      } catch (parseError) {
        console.log('Could not parse as JSON:', parseError.message)
      }
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message)
  }
}

debug500Error()