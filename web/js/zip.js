/* Minimal zip writer: stored (uncompressed) entries, no libraries.
   Used by xlsx-fill.js (per-course workbook) and the CS org-badge download
   (PDFs barely compress, so storing costs nothing). */
'use strict';

const zipStore = (() => {
  // ---- crc32 (standard table) ----
  const TBL = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = b => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = TBL[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  // entries [{name, data:Uint8Array}] → Blob of `type`
  return function zipStore(entries, type) {
    const enc = new TextEncoder();
    const parts = [], cdir = [];
    let off = 0;
    const u16 = v => new Uint8Array([v & 255, (v >> 8) & 255]);
    const u32 = v => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);
    for (const e of entries) {
      const name = enc.encode(e.name), crc = crc32(e.data);
      const head = [u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(0), u16(0x21), // UTF-8 names; fixed DOS time/date
                    u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length), u16(0)];
      parts.push(...head, name, e.data);
      cdir.push([u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0x21),
                 u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length),
                 u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name]);
      off += head.reduce((n, a) => n + a.length, 0) + name.length + e.data.length;
    }
    const cd = cdir.flat();
    const cdLen = cd.reduce((n, a) => n + a.length, 0);
    parts.push(...cd,
      u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(cdLen), u32(off), u16(0));
    return new Blob(parts, { type });
  };

})();
