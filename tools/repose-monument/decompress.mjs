import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { dedup } from '@gltf-transform/functions';
const [,, src, dst] = process.argv;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
// strip meshopt: disable required extension by re-writing plain
const plain = new NodeIO();
await plain.write(dst, doc);
console.log('wrote', dst);
