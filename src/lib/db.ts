import { MongoClient, Db, Collection, ObjectId, Binary } from 'mongodb';
import { config } from './config';

export type Tahap = 'penatua' | 'diaken' | 'selesai';
export type Jabatan = 'penatua' | 'diaken';

export interface KolomDoc {
  _id: number; // nomor kolom 1..19
  nama: string;
  kode: string;
  tahap: Tahap;
  // Token sesi petugas yang sedang aktif: satu sesi per kolom;
  // login dari perangkat lain menggantikan token sehingga sesi lama putus.
  sesiToken?: string | null;
  // Kapan terakhir petugas kolom ini memanggil API (heartbeat)
  petugasAktifPada?: Date | null;
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

export interface AuditDoc {
  _id?: ObjectId;
  waktu: Date;
  kolomId: number;
  kandidatId: ObjectId;
  jabatan: Jabatan;
  delta: number;
  suaraBaru: number;
  ip: string;
}

interface InMemoryStore {
  kolom: Map<number, KolomDoc>;
  kandidat: Map<string, KandidatDoc>;
  audit: AuditDoc[];
}

declare global {
  // eslint-disable-next-line no-var
  var _votingMongo: Promise<Db> | undefined;
  // eslint-disable-next-line no-var
  var _votingInMemoryStore: InMemoryStore | undefined;
  // eslint-disable-next-line no-var
  var _votingUseInMemory: boolean | undefined;
}

function getInMemoryStore(): InMemoryStore {
  if (!global._votingInMemoryStore) {
    const kolomMap = new Map<number, KolomDoc>();
    for (let i = 1; i <= config.jumlahKolom; i++) {
      kolomMap.set(i, {
        _id: i,
        nama: `Kolom ${i}`,
        kode: `kolom${i}`,
        tahap: 'penatua',
        sesiToken: null,
        petugasAktifPada: null,
      });
    }
    global._votingInMemoryStore = {
      kolom: kolomMap,
      kandidat: new Map<string, KandidatDoc>(),
      audit: [],
    };
  }
  return global._votingInMemoryStore;
}

const inMemoryKolomCollection = {
  countDocuments: async () => getInMemoryStore().kolom.size,
  bulkWrite: async (ops: any[]) => {
    const store = getInMemoryStore();
    for (const op of ops) {
      if (op.updateOne) {
        const filterId = op.updateOne.filter?._id;
        if (filterId && !store.kolom.has(filterId)) {
          store.kolom.set(filterId, {
            _id: filterId,
            nama: op.updateOne.update?.$setOnInsert?.nama ?? `Kolom ${filterId}`,
            kode: op.updateOne.update?.$setOnInsert?.kode ?? `kolom${filterId}`,
            tahap: op.updateOne.update?.$setOnInsert?.tahap ?? 'penatua',
            sesiToken: null,
            petugasAktifPada: null,
          });
        }
      }
    }
    return { ok: 1 };
  },
  find: (filter?: any) => {
    const store = getInMemoryStore();
    let list = Array.from(store.kolom.values());
    if (filter?._id) {
      if (typeof filter._id === 'object' && filter._id.$gt !== undefined) {
        list = list.filter((k) => k._id > filter._id.$gt);
      } else {
        list = list.filter((k) => k._id === filter._id);
      }
    }
    return {
      sort: (sortObj: Record<string, number>) => {
        if (sortObj._id) {
          list.sort((a, b) => (sortObj._id > 0 ? a._id - b._id : b._id - a._id));
        }
        return {
          toArray: async () => list.map((item) => ({ ...item })),
        };
      },
      toArray: async () => list.map((item) => ({ ...item })),
    };
  },
  findOne: async (filter: any) => {
    const store = getInMemoryStore();
    if (filter?._id !== undefined) {
      const item = store.kolom.get(filter._id);
      if (!item) return null;
      if (filter.sesiToken !== undefined && item.sesiToken !== filter.sesiToken) return null;
      return { ...item };
    }
    return null;
  },
  findOneAndUpdate: async (filter: any, update: any, _options?: any) => {
    const store = getInMemoryStore();
    const item = store.kolom.get(filter._id);
    if (!item) return null;
    if (filter.sesiToken !== undefined && item.sesiToken !== filter.sesiToken) return null;
    if (update.$set) {
      Object.assign(item, update.$set);
    }
    return { ...item };
  },
  updateOne: async (filter: any, update: any) => {
    const store = getInMemoryStore();
    const item = store.kolom.get(filter._id);
    if (item) {
      if (update.$set) Object.assign(item, update.$set);
      return { matchedCount: 1, modifiedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  },
  updateMany: async (_filter: any, update: any) => {
    const store = getInMemoryStore();
    let modified = 0;
    for (const item of store.kolom.values()) {
      if (update.$set) {
        Object.assign(item, update.$set);
        modified++;
      }
    }
    return { matchedCount: store.kolom.size, modifiedCount: modified };
  },
  deleteMany: async (filter: any) => {
    const store = getInMemoryStore();
    let count = 0;
    if (filter?._id?.$gt !== undefined) {
      const threshold = filter._id.$gt;
      for (const [id] of store.kolom) {
        if (id > threshold) {
          store.kolom.delete(id);
          count++;
        }
      }
    }
    return { deletedCount: count };
  },
};

const inMemoryKandidatCollection = {
  createIndex: async (_idx: any) => {},
  countDocuments: async (filter?: any) => {
    const store = getInMemoryStore();
    let list = Array.from(store.kandidat.values());
    if (filter?.kolomId !== undefined) list = list.filter((k) => k.kolomId === filter.kolomId);
    if (filter?.jabatan !== undefined) list = list.filter((k) => k.jabatan === filter.jabatan);
    if (filter?.suara?.$gt !== undefined) list = list.filter((k) => k.suara > filter.suara.$gt);
    return list.length;
  },
  find: (filter?: any, options?: any) => {
    const store = getInMemoryStore();
    let list = Array.from(store.kandidat.values());
    if (filter?.kolomId !== undefined) {
      if (typeof filter.kolomId === 'object' && filter.kolomId.$gt !== undefined) {
        list = list.filter((k) => k.kolomId > filter.kolomId.$gt);
      } else {
        list = list.filter((k) => k.kolomId === filter.kolomId);
      }
    }
    if (filter?.jabatan !== undefined) list = list.filter((k) => k.jabatan === filter.jabatan);

    const projection = options?.projection;
    const formatList = (arr: KandidatDoc[]) =>
      arr.map((k) => {
        const copy = { ...k };
        if (projection?.foto === 0) {
          delete (copy as any).foto;
        }
        return copy;
      });

    return {
      sort: (sortObj: Record<string, number>) => {
        list.sort((a, b) => {
          for (const [key, dir] of Object.entries(sortObj)) {
            const valA = (a as any)[key];
            const valB = (b as any)[key];
            if (valA < valB) return dir > 0 ? -1 : 1;
            if (valA > valB) return dir > 0 ? 1 : -1;
          }
          return 0;
        });
        return {
          toArray: async () => formatList(list),
        };
      },
      toArray: async () => formatList(list),
    };
  },
  findOne: async (filter: any, _options?: any) => {
    const store = getInMemoryStore();
    let idStr = '';
    if (filter?._id instanceof ObjectId) idStr = filter._id.toString();
    else if (filter?._id) idStr = String(filter._id);

    const found = store.kandidat.get(idStr);
    if (!found) return null;
    return { ...found };
  },
  insertOne: async (doc: KandidatDoc) => {
    const store = getInMemoryStore();
    const id = doc._id || new ObjectId();
    doc._id = id;
    store.kandidat.set(id.toString(), { ...doc });
    return { insertedId: id };
  },
  updateOne: async (filter: any, update: any) => {
    const store = getInMemoryStore();
    const idStr = filter?._id instanceof ObjectId ? filter._id.toString() : String(filter?._id ?? '');
    const k = store.kandidat.get(idStr);
    if (k && (filter?.kolomId === undefined || k.kolomId === filter.kolomId)) {
      if (update.$set) Object.assign(k, update.$set);
      if (update.$inc) {
        for (const [prop, val] of Object.entries(update.$inc)) {
          (k as any)[prop] = ((k as any)[prop] ?? 0) + Number(val);
        }
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  },
  updateMany: async (_filter: any, update: any) => {
    const store = getInMemoryStore();
    let count = 0;
    for (const k of store.kandidat.values()) {
      if (update.$set) {
        Object.assign(k, update.$set);
        count++;
      }
    }
    return { matchedCount: store.kandidat.size, modifiedCount: count };
  },
  deleteOne: async (filter: any) => {
    const store = getInMemoryStore();
    const idStr = filter?._id instanceof ObjectId ? filter._id.toString() : String(filter?._id ?? '');
    const k = store.kandidat.get(idStr);
    if (k && (filter?.kolomId === undefined || k.kolomId === filter.kolomId)) {
      store.kandidat.delete(idStr);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  },
  deleteMany: async (filter: any) => {
    const store = getInMemoryStore();
    let count = 0;
    for (const [id, k] of Array.from(store.kandidat.entries())) {
      let match = true;
      if (filter?.kolomId !== undefined) {
        if (typeof filter.kolomId === 'object' && filter.kolomId.$gt !== undefined) {
          if (k.kolomId <= filter.kolomId.$gt) match = false;
        } else if (k.kolomId !== filter.kolomId) {
          match = false;
        }
      }
      if (filter?.jabatan !== undefined && k.jabatan !== filter.jabatan) {
        match = false;
      }
      if (match) {
        store.kandidat.delete(id);
        count++;
      }
    }
    return { deletedCount: count };
  },
  findOneAndUpdate: async (filter: any, update: any, _options?: any) => {
    const store = getInMemoryStore();
    const idStr = filter?._id instanceof ObjectId ? filter._id.toString() : String(filter?._id ?? '');
    const k = store.kandidat.get(idStr);
    if (!k) return null;
    if (filter.kolomId !== undefined && k.kolomId !== filter.kolomId) return null;
    if (filter.jabatan !== undefined && k.jabatan !== filter.jabatan) return null;
    if (filter.suara?.$gte !== undefined && k.suara < filter.suara.$gte) return null;

    if (update.$inc) {
      for (const [prop, val] of Object.entries(update.$inc)) {
        (k as any)[prop] = ((k as any)[prop] ?? 0) + Number(val);
      }
    }
    if (update.$set) {
      Object.assign(k, update.$set);
    }
    return { ...k };
  },
  aggregate: <T = any>(_pipeline: any[]) => {
    const store = getInMemoryStore();
    const groupMap = new Map<number, { _id: number; jumlahKandidat: number; totalSuara: number }>();
    for (const k of store.kandidat.values()) {
      const existing = groupMap.get(k.kolomId) || { _id: k.kolomId, jumlahKandidat: 0, totalSuara: 0 };
      existing.jumlahKandidat += 1;
      existing.totalSuara += k.suara;
      groupMap.set(k.kolomId, existing);
    }
    const result = Array.from(groupMap.values()) as unknown as T[];
    return {
      toArray: async () => result,
    };
  },
};

async function sambung(): Promise<Db> {
  const client = new MongoClient(config.db.uri, {
    serverSelectionTimeoutMS: 2000,
    connectTimeoutMS: 2000,
  });
  await client.connect();
  const database = client.db(config.db.name);

  // Seed kolom 1..N hanya saat database masih kosong,
  // setelah itu jumlah kolom sepenuhnya dikelola admin.
  const kolom = database.collection<KolomDoc>('kolom');
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

  await database.collection<KandidatDoc>('kandidat').createIndex({ kolomId: 1, jabatan: 1 });

  return database;
}

export async function db(): Promise<Db | null> {
  if (global._votingUseInMemory) return null;
  if (!global._votingMongo) {
    global._votingMongo = sambung().catch((e) => {
      console.warn('[AI Studio] MongoDB unreachable, falling back to in-memory store:', e.message);
      global._votingUseInMemory = true;
      global._votingMongo = undefined;
      return null as any;
    });
  }
  const res = await global._votingMongo;
  return res;
}

export async function koleksiKolom(): Promise<Collection<KolomDoc>> {
  if (global._votingUseInMemory) return inMemoryKolomCollection as unknown as Collection<KolomDoc>;
  try {
    const d = await db();
    if (d) return d.collection<KolomDoc>('kolom');
  } catch {
    global._votingUseInMemory = true;
  }
  return inMemoryKolomCollection as unknown as Collection<KolomDoc>;
}

export async function koleksiKandidat(): Promise<Collection<KandidatDoc>> {
  if (global._votingUseInMemory) return inMemoryKandidatCollection as unknown as Collection<KandidatDoc>;
  try {
    const d = await db();
    if (d) return d.collection<KandidatDoc>('kandidat');
  } catch {
    global._votingUseInMemory = true;
  }
  return inMemoryKandidatCollection as unknown as Collection<KandidatDoc>;
}

// Validasi sesi petugas (token harus cocok dengan sesi aktif kolom) sekaligus
// mencatat heartbeat aktivitas. Mengembalikan dokumen kolom, atau null bila
// sesi sudah digantikan login dari perangkat lain.
export async function petugasResmi(
  kolomId: number,
  token: string | undefined
): Promise<KolomDoc | null> {
  if (!token) return null;
  const kolom = await koleksiKolom();
  return (await kolom.findOneAndUpdate(
    { _id: kolomId, sesiToken: token },
    { $set: { petugasAktifPada: new Date() } },
    { returnDocument: 'after' }
  )) as KolomDoc | null;
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

export function statusDatabase(): { mode: 'mongodb' | 'memory'; info: string } {
  if (global._votingUseInMemory) {
    return { mode: 'memory', info: 'In-Memory (Preview Mode)' };
  }
  return { mode: 'mongodb', info: 'MongoDB Connected' };
}

// Catat riwayat audit mutasi suara untuk keperluan forensik
export async function catatAuditTally(entri: {
  kolomId: number;
  kandidatId: ObjectId;
  jabatan: Jabatan;
  delta: number;
  suaraBaru: number;
  ip: string;
}): Promise<void> {
  const data: AuditDoc = {
    ...entri,
    waktu: new Date(),
  };
  if (global._votingUseInMemory) {
    getInMemoryStore().audit.push(data);
    return;
  }
  try {
    const d = await db();
    if (d) {
      await d.collection<AuditDoc>('audit_log').insertOne(data);
    } else {
      getInMemoryStore().audit.push(data);
    }
  } catch {
    getInMemoryStore().audit.push(data);
  }
}

export { ObjectId, Binary };
