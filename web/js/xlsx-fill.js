/* Fill the Available (D) column of a per-course xlsx and return a Blob.
   xlsx = zip; we inflate entries natively (DecompressionStream), string-patch
   xl/worksheets/sheet1.xml, and rebuild the zip via zipStore (zip.js) —
   no libraries. Template bytes otherwise untouched. */
'use strict';

const xlsxFill = (() => {
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
    return zipStore(entries, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
})();
