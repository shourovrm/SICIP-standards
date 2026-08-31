/* Fill the Available (D) column of a per-course xlsx and return a Blob.
   xlsx = zip; we inflate entries natively (DecompressionStream), string-patch
   xl/worksheets/sheet1.xml, and rebuild the zip with stored (uncompressed)
   entries — no libraries. Template bytes otherwise untouched. */
'use strict';

const xlsxFill = (() => {
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

  const inflate = async bytes => {
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  };

  // parse central directory → [{name, data(Promise resolved later)}]
  async function unzip(buf) {
    const b = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = b.length - 22;
    while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error('not a zip');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const entries = [];
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('bad cdir');
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nlen = dv.getUint16(off + 28, true);
      const elen = dv.getUint16(off + 30, true);
      const clen = dv.getUint16(off + 32, true);
      const lho = dv.getUint32(off + 42, true);
      const name = new TextDecoder().decode(b.subarray(off + 46, off + 46 + nlen));
      // local header: sizes of name/extra may differ from central copies
      const lnlen = dv.getUint16(lho + 26, true), lelen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lelen;
      const raw = b.subarray(start, start + csize);
      entries.push({ name, data: method === 8 ? await inflate(raw) : raw.slice() });
      off += 46 + nlen + elen + clen;
    }
    return entries;
  }

  // rebuild zip, all entries stored (files are tiny; zero compression complexity)
  function zip(entries) {
    const enc = new TextEncoder();
    const parts = [], cdir = [];
    let off = 0;
    const u16 = v => new Uint8Array([v & 255, (v >> 8) & 255]);
    const u32 = v => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);
    for (const e of entries) {
      const name = enc.encode(e.name), crc = crc32(e.data);
      const head = [u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21), // fixed DOS time/date
                    u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length), u16(0)];
      parts.push(...head, name, e.data);
      cdir.push([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
                 u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length),
                 u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name]);
      off += head.reduce((n, a) => n + a.length, 0) + name.length + e.data.length;
    }
    const cd = cdir.flat();
    const cdLen = cd.reduce((n, a) => n + a.length, 0);
    parts.push(...cd,
      u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
      u32(cdLen), u32(off), u16(0));
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* fetch the per-course workbook, write `values` into D16.. (blank rows stay blank) */
  return async function xlsxFill(url, values) {
    const buf = await (await fetch(url)).arrayBuffer();
    const entries = await unzip(buf);
    const sheet = entries.find(e => e.name === 'xl/worksheets/sheet1.xml');
    let xml = new TextDecoder().decode(sheet.data);
    values.forEach((v, i) => {
      // always write, 0 included: a blank D cell scores FULL weight in Excel
      // (MIN ignores blanks), which would disagree with the page calculator
      const r = 16 + i;
      xml = xml.replace(new RegExp(`(<c r="D${r}"[^>]*?)(/>|>(?:<v>[^<]*</v>)?</c>)`),
                        `$1><v>${v}</v></c>`);
    });
    sheet.data = new TextEncoder().encode(xml);
    return zip(entries);
  };
})();
