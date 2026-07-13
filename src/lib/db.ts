import { MongoClient, Db, Collection, ObjectId, Binary } from 'mongodb';
import { config } from './config';

export type Tahap = 'penatua' | 'diaken' | 'selesai';
export type Jabatan = 'penatua' | 'diaken';

export interface KolomDoc {
  _id: number; // nomor kolom 1..19
  nama: string;
  kode: string;
  tahap: Tahap;
}

export interface KandidatDoc {
  _id: ObjectId;
  kolomId: number;
  jabatan: Jabatan;
  nama: string;
  suara: number;
  // Terpilih secara aklamasi (mis. diaken diambil dari peringkat 2 suara penatua)
  aklamasi?: boolean;
  foto?: Binary | null;
  fotoTipe?: string | null;
  fotoVersi: number;
}

declare global {
  // eslint-disable-next-line no-var
  var _votingMongo: Promise<Db> | undefined;
}

async function sambung(): Promise<Db> {
  const client = new MongoClient(config.db.uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });
  await client.connect();
  const db = client.db(config.db.name);

  // Seed kolom 1..N hanya saat database masih kosong —
  // setelah itu jumlah kolom sepenuhnya dikelola admin.
  const kolom = db.collection<KolomDoc>('kolom');
  const ada = await kolom.countDocuments();
  if (ada === 0) {
    await kolom.bulkWrite(
      Array.from({ length: config.jumlahKolom }, (_, i) => ({
        updateOne: {
          filter: { _id: i + 1 },
          update: {
            $setOnInsert: {
              nama: `Kolom ${i + 1}`,
              kode: `kolom${i + 1}`,
              tahap: 'penatua' as Tahap,
            },
          },
          upsert: true,
        },
      }))
    );
  }

  await db.collection<KandidatDoc>('kandidat').createIndex({ kolomId: 1, jabatan: 1 });

  return db;
}

export async function db(): Promise<Db> {
  if (!global._votingMongo) {
    global._votingMongo = sambung().catch((e) => {
      // Jangan cache kegagalan — biarkan permintaan berikutnya mencoba lagi
      global._votingMongo = undefined;
      throw e;
    });
  }
  return global._votingMongo;
}

export async function koleksiKolom(): Promise<Collection<KolomDoc>> {
  return (await db()).collection<KolomDoc>('kolom');
}

export async function koleksiKandidat(): Promise<Collection<KandidatDoc>> {
  return (await db()).collection<KandidatDoc>('kandidat');
}

// Bentuk kandidat untuk respons JSON (tanpa data biner foto)
export function kandidatKeJson(k: KandidatDoc) {
  return {
    id: k._id.toString(),
    jabatan: k.jabatan,
    nama: k.nama,
    suara: k.suara,
    aklamasi: !!k.aklamasi,
    foto: k.fotoTipe ? `/api/foto/${k._id.toString()}?v=${k.fotoVersi}` : null,
  };
}

export { ObjectId, Binary };
