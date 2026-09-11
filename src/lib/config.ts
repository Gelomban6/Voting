// Konfigurasi aplikasi.
// Semua rahasia dibaca dari environment (.env.local), lihat .env.example.

function ambilEnv(nama: string, defaultVal: string): string {
  const nilai = process.env[nama];
  if (!nilai) {
    if (process.env.NODE_ENV === 'production' && (nama === 'ADMIN_PASSWORD' || nama === 'SESSION_SECRET')) {
      console.warn(`[KEAMANAN] Perhatian: ${nama} menggunakan nilai bawaan default di mode produksi. Sangat disarankan untuk menyetel nilai rahasia di environment.`);
    }
    return defaultVal;
  }
  return nilai;
}

export const config = {
  db: {
    uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    name: process.env.DB_NAME ?? 'voting_quickcount',
  },

  adminPassword: ambilEnv('ADMIN_PASSWORD', 'admin123'),
  sessionSecret: ambilEnv('SESSION_SECRET', 'voting-quickcount-session-secret-key-32chars'),

  appTitle: 'Quick Count Pemilihan Penatua & Diaken',
  jumlahKolom: 19,

  // Interval refresh halaman quick count (milidetik)
  refreshInterval: 4000,
};
