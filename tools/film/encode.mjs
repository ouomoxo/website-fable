import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
const [,, srcDir, dstDir, qArg, wArg] = process.argv;
const q = +(qArg || 76), width = +(wArg || 0);
fs.mkdirSync(dstDir, { recursive: true });
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png')).sort();
let total = 0;
for (const f of files) {
  let img = sharp(path.join(srcDir, f));
  if (width) img = img.resize({ width, withoutEnlargement: true });
  const out = path.join(dstDir, f.replace('.png', '.webp'));
  await img.webp({ quality: q, effort: 5 }).toFile(out);
  total += fs.statSync(out).size;
}
console.log(`encoded ${files.length} → ${dstDir}  (${(total/1048576).toFixed(2)} MB, q${q}${width?`, ${width}w`:''})`);
