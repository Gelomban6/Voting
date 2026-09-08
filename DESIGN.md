# Design Direction: Quick Count Pemilihan Penatua & Diaken

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Identitas & Karakter
- Produk: Aplikasi Quick Count dan Panel Rekapitulasi Pemilihan Penatua & Diaken Gereja.
- Pengguna: Jemaat (layar proyektor/publik), Panitia Pusat (panel admin & berita acara), dan Petugas Kolom (panel pencatatan suara).
- Karakter: Khidmat, transparan, tertib, dan memiliki tingkat keterbacaan tinggi baik di layar proyektor besar maupun layar ponsel petugas.

## Palet Warna
- Latar Utama: #0f172a (Slate gelap yang tenang, tidak menyilaukan saat diproyeksikan)
- Kartu & Panel: #1e293b dengan batas lembut #334155
- Teks Utama: #f8fafc (Kontras sangat tinggi, nyaman dibaca dari kejauhan)
- Teks Pendukung: #94a3b8 (Memenuhi standar WCAG AA > 4.5:1)
- Teks Keterangan: #8fa2b8 (Kontras >= 5.0:1 pada panel)
- Penatua: #38bdf8 (Biru langit yang sejuk dan jelas)
- Diaken: #fbbf24 (Amber hangat pembeda jabatan)
- Status Selesai / Terpilih: #34d399 (Hijau zamrud yang tegas dan positif)

## Tipografi
- Keluarga Huruf: Segoe UI, system-ui, -apple-system, sans-serif
- Angka & Suara: ont-variant-numeric: tabular-nums untuk menjaga kestabilan posisi angka saat bergulir.

## Skala Gerak (Motion)
- MOTION 1: Animasi difungsikan secara murni untuk indikasi fungsional (misalnya pergantian angka odometer dan transisi fokus kolom). Tidak ada animasi berputar terus-menerus tanpa henti (endless loops) atau efek mengambang dekoratif.
