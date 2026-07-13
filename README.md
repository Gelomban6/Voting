# Quick Count Pemilihan Penatua & Diaken

Aplikasi **Next.js + MongoDB** untuk menampilkan hasil sementara (quick count)
pemilihan penatua dan diaken dari **19 kolom/kelompok**, dengan petugas input
per kolom dan tahapan pemilihan **Penatua dulu → baru Diaken**.

## Cara Menjalankan

```bash
npm install        # sekali saja
npm run dev        # mode pengembangan → http://localhost:3123
```

Untuk acara sesungguhnya (lebih cepat & stabil):

```bash
npm run build
npm start          # → http://localhost:3123
```

MongoDB harus berjalan (bawaan: `mongodb://127.0.0.1:27017`). Database
`voting_quickcount` beserta koleksi dan 19 kolom dibuat **otomatis** saat
pertama diakses.

## Halaman

| URL | Untuk | Keterangan |
|---|---|---|
| `/` | Publik / proyektor | Quick count model **hero + carousel center-mode**: kolom aktif tampil sebagai banner besar, strip kartu kecil di bawahnya (kartu tengah di-highlight, kartu lain bisa diklik). Geser otomatis tiap 7 detik; **mengklik kartu/panah/titik mengunci carousel** di kolom itu (tombol ikon ⏸/🔒 di bawah untuk jeda/lanjut). Saat suara bertambah, angka **bergulir ala odometer** dan baris calon berkilau hijau. Kolom yang **selesai** menampilkan satu panel **Terpilih** (foto besar penatua & diaken dengan lencana ✓) — otomatis hilang bila sesi dibuka kembali (pemilihan ulang) dan menandai **Seri** bila suara teratas sama. Refresh data tiap 4 detik |
| `/login` | Petugas & admin | Petugas memilih kolomnya + kode akses; admin pakai password |
| `/petugas` | Petugas kolom | Kelola calon (nama + foto), hitung suara model **tally +1**, kendali sesi |
| `/admin` | Panitia pusat | Kelola nama & kode akses tiap kolom, ubah paksa tahap, reset data |

## Alur Pemilihan per Kolom

1. Petugas login dengan **kode akses kolomnya** (bawaan: `kolom1` … `kolom19`).
2. Masukkan nama calon; klik avatarnya untuk memasang **foto** (JPG/PNG/WebP,
   maks 2 MB) — foto ikut tampil di card quick count.
3. **Sesi 1 — Penatua**: setiap kali satu suara dibacakan, tekan tombol **+1**
   calon yang bersangkutan. Angka langsung tersimpan dan tampil live di quick
   count. Tombol **−** untuk koreksi. Suara diaken masih terkunci.
4. Setelah penghitungan penatua rampung, klik **"💾 Simpan Sesi Penatua →
   Mulai Diaken"** — sesi penatua terkunci, sesi diaken terbuka.
5. **Sesi 2 — Diaken**: hitung dengan cara yang sama, lalu klik
   **"💾 Simpan & Selesaikan Pemilihan"**. Card kolom berstatus **Selesai**.
   Sesi bisa dibuka kembali bila perlu koreksi.

Halaman publik menampilkan kolom aktif sebagai **hero/banner besar** (foto
calon, peringkat 👑, bar suara, badge sesi, penghitung "01/19") dan strip
navigasi center-mode di bawahnya — kartu tengah menyala, kartu samping redup
dan dapat diklik untuk berpindah kolom.

## Konfigurasi

Semua rahasia ada di **`.env.local`** (tidak ikut ter-commit; contoh di
[.env.example](.env.example)):

- `ADMIN_PASSWORD` — password panel admin. **Ganti sebelum acara!**
- `SESSION_SECRET` — secret tanda tangan cookie sesi, isi string acak panjang
- `MONGODB_URI` — koneksi MongoDB (bawaan `mongodb://127.0.0.1:27017`;
  bisa juga connection string MongoDB Atlas)
- `DB_NAME` — nama database (bawaan `voting_quickcount`)

Pengaturan non-rahasia (judul, jumlah kolom, interval refresh) tetap di
[src/lib/config.ts](src/lib/config.ts). Kode akses tiap kolom diganti lewat
**Panel Admin**, bukan file config.

Setelah mengubah `.env.local`, restart server (`npm run dev` / `npm start`).

## Sebelum Acara

1. Ganti `ADMIN_PASSWORD` dan `SESSION_SECRET` di `.env.local`.
2. Login admin → ganti semua kode akses kolom → bagikan ke petugas.
3. Panel Admin → **Zona Berbahaya** → "Hapus Semua Calon & Suara" untuk
   membersihkan data uji coba (saat ini Kolom 1 berisi data contoh).

## Catatan Teknis

- Versi PHP lama tersimpan di folder [_php-version/](_php-version) (tidak terpakai).
- Struktur DB (MongoDB): koleksi `kolom` (`_id` = nomor 1–19, nama, kode,
  tahap) dan `kandidat` (kolomId, jabatan, nama, suara, foto Binary) — calon
  melekat pada kolomnya masing-masing; foto disimpan di database sehingga
  tidak perlu folder upload.
- Penambahan suara memakai `findOneAndUpdate` dengan `$inc` atomik yang hanya
  cocok bila jabatan calon sama dengan tahap kolom yang sedang berlangsung
  (dan `suara ≥ 1` untuk pengurangan) — sesi yang sudah disimpan otomatis
  terkunci juga di sisi server.
- Sesi login memakai cookie HMAC (httpOnly, 12 jam).
