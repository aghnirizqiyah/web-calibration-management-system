## Fitur Utama Aplikasi

1. Dashboard Pemantauan Dinamis: Ringkasan data instrumen secara real-time (Total, Not Yet, Calibrated, Overdue) dengan filter canggih berdasarkan Bulan, Tahun, Jenis Mesin (Baking/Packaging), dan Lokasi Plant (PGA, PSPD, PDP, PGMJ).

2. Manajemen Master Data Aset (ManageAssets): Registrasi instrumen baru, penghapusan data aman dengan konfirmasi modal, registrasi nomor seri sertifikat masal (pool data), serta pengeditan data master tanpa terikat status operasional alat.

3. Eksekusi Input Kalibrasi Lapangan: Tombol aksi pintar di halaman Dashboard yang memicu formulir modal input hasil riil suhu lapangan bagi alat yang berstatus Plan / Expired.

4. Sertifikat PDF Dinamis: Logika penomoran dan perubahan status otomatis menjadi Calibrated. Tombol aksi langsung berubah menjadi fungsi cetak/unduh sertifikat PDF resmi begitu kalibrasi dinyatakan selesai.

5. Desain Super Responsif: Layout desktop menggunakan struktur tabel yang efisien, sedangkan tampilan mobile otomatis bertransisi menjadi susunan kartu informatif (Instrument Cards) yang dioptimalkan untuk performa gawai operator lapangan.

## Stack Teknologi & Pustaka yang Digunakan

### Frontend 
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### Backend
- FastAPI
- PostgreSQL
- Wkhtmltopdf