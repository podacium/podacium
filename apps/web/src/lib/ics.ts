function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function generateIcsBlob(params: {
  title: string
  description?: string | null
  startDate: string
  durationMinutes?: number | null
  location?: string | null
  organizer?: string | null
  url?: string | null
}): Blob {
  const start = new Date(params.startDate)
  const end = params.durationMinutes
    ? new Date(start.getTime() + params.durationMinutes * 60_000)
    : new Date(start.getTime() + 60 * 60_000)

  const now = formatIcsDate(new Date())
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@podacium`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Podacium//Live Sessions//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
  ]

  if (params.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(params.description)}`)
  }

  if (params.location) {
    lines.push(`LOCATION:${escapeIcsText(params.location)}`)
  }

  if (params.url) {
    lines.push(`URL:${params.url}`)
  }

  if (params.organizer) {
    lines.push(`ORGANIZER;CN=${escapeIcsText(params.organizer)}:mailto:${params.organizer}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
}

export function getGoogleCalendarUrl(params: {
  title: string
  description?: string | null
  startDate: string
  durationMinutes?: number | null
}): string {
  const start = new Date(params.startDate)
  const end = params.durationMinutes
    ? new Date(start.getTime() + params.durationMinutes * 60_000)
    : new Date(start.getTime() + 60 * 60_000)

  const text = encodeURIComponent(params.title)
  const dates = formatIcsDate(start) + '/' + formatIcsDate(end)
  const details = params.description ? encodeURIComponent(params.description) : ''

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`
}

export function getOutlookCalendarUrl(params: {
  title: string
  description?: string | null
  startDate: string
  durationMinutes?: number | null
}): string {
  const start = new Date(params.startDate)
  const end = params.durationMinutes
    ? new Date(start.getTime() + params.durationMinutes * 60_000)
    : new Date(start.getTime() + 60 * 60_000)

  const text = encodeURIComponent(params.title)
  const startStr = start.toISOString().replace(/-/g, '').replace(/:/g, '').split('.')[0]
  const endStr = end.toISOString().replace(/-/g, '').replace(/:/g, '').split('.')[0]
  const details = params.description ? encodeURIComponent(params.description) : ''

  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${text}&startdt=${startStr}&enddt=${endStr}&body=${details}`
}
