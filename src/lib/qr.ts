import QRCode from 'qrcode';

/**
 * Menghasilkan Data URL gambar PNG untuk QR Code.
 */
export async function generateQRDataURL(
  teks: string,
  ukuran: number = 320
): Promise<string> {
  return QRCode.toDataURL(teks, {
    width: ukuran,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
}

/**
 * Mengunduh Data URL gambar sebagai file PNG.
 */
export function unduhQRDataURL(dataUrl: string, namaFile: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = namaFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Membentuk URL lengkap pemantau hasil kolom untuk QR Code.
 */
export function dapatkanUrlPengamatKolom(kolomId: number): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/kolom/${kolomId}`;
  }
  return `/kolom/${kolomId}`;
}
