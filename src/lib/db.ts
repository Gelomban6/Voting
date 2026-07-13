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
  foto?: Binary | null;
  fotoTipe?: string | null;
  fotoVersi: number;
}

declare global {
  // eslint-disable-next-line no-var
  var _votingMongo: Promise<Db> | undefined;
}

async function sambung(): Promise<Db> {
  const client = new MongoClient(config.db.uri);
  await client.connect();
  const db = client.db(config.db.name);

  // Seed kolom 1..N (hanya menambah yang belum ada)
  const kolom = db.collection<KolomDoc>('kolom');
  const ada = await kolom.countDocuments();
  if (ada < config.jumlahKolom) {
    for (let n = 1; n <= config.jumlahKolom; n++) {
      await kolom.updateOne(
        { _id: n },
        { $setOnInsert: { nama: `Kolom ${n}`, kode: `kolom${n}`, tahap: 'penatua' } },
        { upsert: true }
      );
    }
  }

  await db.collection<KandidatDoc>('kandidat').createIndex({ kolomId: 1, jabatan: 1 });

  return db;
}

export async function db(): Promise<Db> {
  if (!global._votingMongo) {
    global._votingMongo = sambung();
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
    foto: k.fotoTipe ? `/api/foto/${k._id.toString()}?v=${k.fotoVersi}` : null,
  };
}

export { ObjectId, Binary };
