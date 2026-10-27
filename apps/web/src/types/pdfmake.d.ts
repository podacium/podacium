declare module 'pdfmake/build/pdfmake' {
  interface PdfMakeStatic {
    vfs: Record<string, string>
    fonts: Record<string, Record<string, string>>
    createPdf(docDef: any): {
      download(filename?: string): void
      open(): void
      print(): void
      getBlob(cb: (blob: Blob) => void): void
      getBase64(cb: (data: string) => void): void
      getDataUrl(cb: (url: string) => void): void
      getBuffer(cb: (buffer: ArrayBuffer) => void): void
    }
  }
  const pdfMake: PdfMakeStatic
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>
  export default vfs
}
