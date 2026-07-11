import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { dedup, weld, prune } from '@gltf-transform/functions';
const [,, src, dst] = process.argv;
await MeshoptEncoder.ready;
const inIO = new NodeIO();
const doc = await inIO.read(src);
await doc.transform(dedup(), weld({ tolerance: 0.0001 }), prune());
const outIO = new NodeIO()
  .registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
doc.createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await outIO.write(dst, doc);
console.log('wrote', dst);
