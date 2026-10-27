interface PdfSection {
  title: string
  items: string[]
}

interface PageMeta {
  title: string
  locale: string
  companyName: string
  companyAddress: string
  effectiveDate: string
  version: string
}

function buildDocDefinition(sections: PdfSection[], meta: PageMeta): any {
  const isArabic = meta.locale === 'ar'
  const font = isArabic ? 'Amiri' : 'Roboto'

  const content: any[] = []

  content.push(
    { text: meta.title, style: 'title', margin: [0, 0, 0, 4] },
    { text: `${meta.companyName} — ${meta.companyAddress}`, style: 'meta', margin: [0, 0, 0, 2] },
    { text: `Effective: ${meta.effectiveDate}  |  Version: ${meta.version}`, style: 'meta', margin: [0, 0, 0, 12] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#1e3a8a' }] },
    { text: '', margin: [0, 0, 0, 6] },
  )

  for (const section of sections) {
    content.push({ text: section.title, style: 'sectionTitle', margin: [0, 10, 0, 4] })
    for (const item of section.items) {
      const isSub = item.match(/^[\d.]+[\s]/) && /\p{L}/u.test(item)
      if (isSub && item.length < 80) {
        content.push({ text: item, style: 'subheading', margin: [0, 5, 0, 2] })
      } else {
        content.push({ text: item, style: 'paragraph', margin: [0, 0, 0, 3] })
      }
    }
  }

  return {
    content,
    defaultStyle: { font, fontSize: 10, lineHeight: 1.5, color: '#1a1a1a' },
    styles: {
      title: { fontSize: 20, bold: true, color: '#1e3a8a' },
      meta: { fontSize: 8, color: '#6b7280' },
      sectionTitle: { fontSize: 14, bold: true, color: '#111827' },
      subheading: { fontSize: 11, bold: true, color: '#1f2937' },
      paragraph: { fontSize: 10, alignment: isArabic ? 'right' : 'justify' },
    },
    pageSize: 'A4',
    pageMargins: [50, 50, 50, 50],
    header: () => ({
      margin: [50, 15, 50, 0],
      text: meta.companyName,
      fontSize: 7,
      color: '#9ca3af',
      alignment: 'left',
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [50, 0, 50, 15],
      columns: [
        {
          text: `© ${new Date().getFullYear()} ${meta.companyName} — Downloaded from www.podacium.com`,
          fontSize: 7,
          color: '#9ca3af',
          alignment: 'left',
        },
        { text: `${currentPage} / ${pageCount}`, fontSize: 7, color: '#9ca3af', alignment: 'right' },
      ],
    }),
  }
}

export async function downloadPageAsPdf(
  _contentSelector: string,
  filename: string,
  meta: PageMeta,
  sections: PdfSection[],
): Promise<void> {
  let pdfMake: any
  try {
    pdfMake = (await import('pdfmake/build/pdfmake')).default
  } catch {
    window.print()
    return
  }

  try {
    const { default: vfs } = await import('./pdfmake-vfs')
    if (vfs && typeof vfs === 'object') pdfMake.vfs = vfs
  } catch {
    console.warn('Custom VFS not available, Arabic fonts may not render')
  }

  pdfMake.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
    Amiri: {
      normal: 'Amiri-Regular.ttf',
      bold: 'Amiri-Bold.ttf',
    },
  }

  const docDef = buildDocDefinition(sections, meta)
  const pdfDoc = pdfMake.createPdf(docDef)
  pdfDoc.download(filename)
}
