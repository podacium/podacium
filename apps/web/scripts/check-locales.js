const fs = require('fs')
const path = require('path')

const locales = ['en', 'fr', 'ar']
const base = path.resolve(__dirname, '../locales')

function flatten(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const val = obj[k]
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof val === 'object' && val !== null) {
      return { ...acc, ...flatten(val, key) }
    }
    acc[key] = val
    return acc
  }, {})
}

// Get list of all json files in en locale directory
const enDir = path.join(base, 'en')
if (!fs.existsSync(enDir)) {
  console.error(`English locale directory does not exist: ${enDir}`)
  process.exit(2)
}

const jsonFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.json'))

let ok = true

for (const file of jsonFiles) {
  const maps = {}
  
  for (const loc of locales) {
    const p = path.join(base, loc, file)
    if (!fs.existsSync(p)) {
      console.error(`Missing locale file: ${p}`)
      ok = false
      continue
    }
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      maps[loc] = flatten(data)
    } catch (e) {
      console.error(`Error parsing file: ${p}`, e.message)
      ok = false
    }
  }

  if (!maps['en']) continue

  const keys = Object.keys(maps['en'])
  for (const k of keys) {
    for (const loc of locales) {
      if (!maps[loc] || !(k in maps[loc])) {
        console.error(`Missing key '${k}' in ${loc}/${file}`)
        ok = false
      } else {
        const val = maps[loc][k]
        if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
          console.error(`Empty/invalid value for key '${k}' in ${loc}/${file}`)
          ok = false
        }
      }
    }
  }
}

if (!ok) {
  console.error('Validation failed! Some keys are missing or have empty values.')
  process.exit(2)
}

console.log('All locale files verified successfully. All keys are present and populated for locales:', locales.join(', '))
process.exit(0)
