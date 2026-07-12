import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { prune, dedup } from '@gltf-transform/functions';
const [,, src, dst] = process.argv;
await MeshoptEncoder.ready;
const doc = await new NodeIO().read(src);
await doc.transform(prune());           // no weld — keep UV-split verts
doc.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await new NodeIO().registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
  .write(dst, doc);
console.log('glb', dst);
