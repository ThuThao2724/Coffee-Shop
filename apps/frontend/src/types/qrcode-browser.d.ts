// The browser build of `qrcode` ships without typings; declare the part StaffManagement uses.
declare module 'qrcode/lib/browser' {
  interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    margin?: number
    scale?: number
    width?: number
    color?: { dark?: string; light?: string }
  }
  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>
  }
  export default QRCode
}
