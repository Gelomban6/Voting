// Konfigurasi aplikasi.
// Semua rahasia dibaca dari environment (.env.local) — lihat .env.example.

function wajib(nama: string): string {
  const nilai = process.env[nama];
  if (!nilai) {
    throw new Error(`Environment variable ${nama} belum diisi. Salin .env.example menjadi .env.local lalu lengkapi.`);
  }
  return nilai;
}

export const config = {
  db: {
    uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    name: process.env.DB_NAME ?? 'voting_quickcount',
  },

  adminPassword: wajib('ADMIN_PASSWORD'),
  sessionSecret: wajib('SESSION_SECRET'),

  appTitle: 'Quick Count Pemilihan Penatua & Diaken',
  jumlahKolom: 19,

  // Interval refresh halaman quick count (milidetik)
  refreshInterval: 4000,
};
