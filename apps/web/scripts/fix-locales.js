const fs = require('fs')
const path = require('path')

const LOCALES = ['en', 'fr', 'ar']
const BASE = path.resolve(__dirname, '../locales')

function deepSet(obj, keyPath, value) {
  const keys = keyPath.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object' || current[keys[i]] === null) {
      current[keys[i]] = {}
    }
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = value
}

function deepGet(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}

function deepDelete(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current) || typeof current[keys[i]] !== 'object') return
    current = current[keys[i]]
  }
  delete current[keys[keys.length - 1]]
}

function flatten(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const val = obj[k]
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return { ...acc, ...flatten(val, key) }
    }
    acc[key] = typeof val === 'string' ? val : JSON.stringify(val)
    return acc
  }, {})
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

const enFiles = fs.readdirSync(path.join(BASE, 'en')).filter(f => f.endsWith('.json')).sort()
let fixes = 0

for (const ns of enFiles) {
  const enData = loadJson(path.join(BASE, 'en', ns))
  const enFlat = flatten(enData)

  for (const loc of LOCALES.slice(1)) {
    const locPath = path.join(BASE, loc, ns)
    if (!fs.existsSync(locPath)) {
      fs.copyFileSync(path.join(BASE, 'en', ns), locPath)
      console.log(`  [${ns}] COPIED from en to ${loc}`)
      fixes++
      continue
    }

    const locData = loadJson(locPath)
    const locFlat = flatten(locData)
    let changed = false

    // Fix missing keys + empty values
    for (const [key, val] of Object.entries(enFlat)) {
      if (!(key in locFlat)) {
        deepSet(locData, key, val)
        console.log(`  [${ns}] FIXED missing in ${loc}: ${key}`)
        changed = true
        fixes++
      } else if (typeof locFlat[key] === 'string' && locFlat[key].trim() === '') {
        deepSet(locData, key, val)
        console.log(`  [${ns}] FIXED empty in ${loc}: ${key}`)
        changed = true
        fixes++
      }
    }

    // Remove orphan keys
    for (const key of Object.keys(locFlat)) {
      if (!(key in enFlat)) {
        deepDelete(locData, key)
        console.log(`  [${ns}] REMOVED orphan in ${loc}: ${key}`)
        changed = true
        fixes++
      }
    }

    if (changed) {
      saveJson(locPath, locData)
    }
  }
}

console.log(`\nTotal fixes applied: ${fixes}`)
