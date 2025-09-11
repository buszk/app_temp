// Minimal ZIP (store only, no compression) generator for text files.
// Usage: createZip([{ path: 'School A/personal_statement.txt', content: '...' }, ...])

function strToUint8(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function writeUint16LE(view, offset, value) {
  view.setUint16(offset, value & 0xffff, true);
}
function writeUint32LE(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function crc32(bytes) {
  // Table-less CRC32 (small, acceptable for modest sizes)
  let crc = ~0;
  for (let i = 0; i < bytes.length; i++) {
    let c = (crc ^ bytes[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}

export function createZip(files) {
  const entries = [];
  let offset = 0;
  const chunks = [];

  for (const file of files) {
    const nameBytes = strToUint8(file.path);
    const dataBytes = typeof file.content === 'string' ? strToUint8(file.content) : (file.content || new Uint8Array());
    const crc = crc32(dataBytes);

    // Local file header
    const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const dv = new DataView(localHeader);
    writeUint32LE(dv, 0, LOCAL_FILE_HEADER_SIGNATURE);
    writeUint16LE(dv, 4, 20); // version needed to extract
    writeUint16LE(dv, 6, 0);  // general purpose bit flag
    writeUint16LE(dv, 8, 0);  // compression method (0 = store)
    writeUint16LE(dv, 10, 0); // last mod time
    writeUint16LE(dv, 12, 0); // last mod date
    writeUint32LE(dv, 14, crc);
    writeUint32LE(dv, 18, dataBytes.length);
    writeUint32LE(dv, 22, dataBytes.length);
    writeUint16LE(dv, 26, nameBytes.length);
    writeUint16LE(dv, 28, 0); // extra field length
    chunks.push(new Uint8Array(localHeader));
    chunks.push(nameBytes);
    chunks.push(dataBytes);

    const entry = {
      nameBytes,
      crc,
      size: dataBytes.length,
      offset,
    };
    offset += (30 + nameBytes.length + dataBytes.length);
    entries.push(entry);
  }

  const centralChunks = [];
  const CENTRAL_DIR_SIGNATURE = 0x02014b50;
  let centralSize = 0;
  for (const e of entries) {
    const hdr = new ArrayBuffer(46 + e.nameBytes.length);
    const dv = new DataView(hdr);
    writeUint32LE(dv, 0, CENTRAL_DIR_SIGNATURE);
    writeUint16LE(dv, 4, 20); // version made by
    writeUint16LE(dv, 6, 20); // version needed to extract
    writeUint16LE(dv, 8, 0);  // general purpose bit flag
    writeUint16LE(dv, 10, 0); // compression method (store)
    writeUint16LE(dv, 12, 0); // time
    writeUint16LE(dv, 14, 0); // date
    writeUint32LE(dv, 16, e.crc);
    writeUint32LE(dv, 20, e.size);
    writeUint32LE(dv, 24, e.size);
    writeUint16LE(dv, 28, e.nameBytes.length);
    writeUint16LE(dv, 30, 0); // extra len
    writeUint16LE(dv, 32, 0); // comment len
    writeUint16LE(dv, 34, 0); // disk number start
    writeUint16LE(dv, 36, 0); // internal file attrs
    writeUint32LE(dv, 38, 0); // external file attrs
    writeUint32LE(dv, 42, e.offset);
    centralChunks.push(new Uint8Array(hdr));
    centralChunks.push(e.nameBytes);
    centralSize += (46 + e.nameBytes.length);
  }

  const END_CENTRAL_SIGNATURE = 0x06054b50;
  const end = new ArrayBuffer(22);
  const dvEnd = new DataView(end);
  writeUint32LE(dvEnd, 0, END_CENTRAL_SIGNATURE);
  writeUint16LE(dvEnd, 4, 0); // number of this disk
  writeUint16LE(dvEnd, 6, 0); // disk where central directory starts
  writeUint16LE(dvEnd, 8, entries.length); // number of central dir records on this disk
  writeUint16LE(dvEnd, 10, entries.length); // total number of central dir records
  writeUint32LE(dvEnd, 12, centralSize);
  writeUint32LE(dvEnd, 16, offset);
  writeUint16LE(dvEnd, 20, 0); // comment length

  // Build final blob
  const all = [...chunks, ...centralChunks, new Uint8Array(end)];
  let total = 0;
  for (const c of all) total += c.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of all) { out.set(c, pos); pos += c.length; }
  return new Blob([out], { type: 'application/zip' });
}

