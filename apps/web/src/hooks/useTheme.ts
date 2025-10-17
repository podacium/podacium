import { useState } from 'react'

export function useTheme() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light')
    return { theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }
}
