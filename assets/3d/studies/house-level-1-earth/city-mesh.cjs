// Build the game mesh from the same parametric study as the high-detail GLB.
// 1. python3 build.py /tmp/house-raw.glb --city
// 2. python3 postprocess.py /tmp/house-raw.glb /tmp/house-painted.glb
// 3. npm install --prefix /tmp/house-tools meshoptimizer@1.0.1
// 4. NODE_PATH=/tmp/house-tools/node_modules node city-mesh.cjs /tmp/house-painted.glb ../../sumer-buildings/house.glb
// FFmpeg encodes embedded JPEGs with full chroma resolution, including the normal maps.
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const {MeshoptSimplifier} = require('meshoptimizer');

async function build(source, destination, budgetScale = 1) {
  if (!Number.isFinite(Number(budgetScale)) || budgetScale <= 0) throw Error('Expected a positive triangle budget multiplier');
  const raw = fs.readFileSync(source);
  const jsonLength = raw.readUInt32LE(12);
  const gltf = JSON.parse(raw.subarray(20, 20 + jsonLength));
  const binary = raw.subarray(28 + jsonLength);
  const oldViews = gltf.bufferViews;
  const oldAccessors = gltf.accessors;
  function read(index) {
    const accessor = oldAccessors[index];
    const view = oldViews[accessor.bufferView];
    const Type = accessor.componentType === 5125 ? Uint32Array : Float32Array;
    return new Type(binary.buffer, binary.byteOffset + view.byteOffset + (accessor.byteOffset || 0), view.byteLength / 4);
  }

  const chunks = [];
  let offset = 0;
  gltf.bufferViews = [];
  gltf.accessors = [];
  function append(buffer, target) {
    const view = {buffer: 0, byteOffset: offset, byteLength: buffer.length};
    if (target) view.target = target;
    chunks.push(buffer);
    offset += buffer.length;
    const padding = (4 - offset % 4) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    return gltf.bufferViews.push(view) - 1;
  }
  function addAccessor(definition, data, target, componentType, count) {
    const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    return gltf.accessors.push({...definition, count, componentType, bufferView: append(buffer, target)}) - 1;
  }

  await MeshoptSimplifier.ready;
  const triangleBudgets = {
    'Straw-tempered mud plaster': 2500, 'Compacted alluvial soil': 300,
    'Dry reed rind and binding': 3300, 'Unpeeled weathered timber': 750,
    'Unpolished terracotta slip': 1000, 'Handwoven fibre': 400
  };
  for (const primitive of gltf.meshes[0].primitives) {
    const {POSITION, NORMAL, TEXCOORD_0} = primitive.attributes;
    const positions = read(POSITION);
    const uv = read(TEXCOORD_0);
    const normals = read(NORMAL);
    const attributes = new Float32Array(positions.length / 3 * 5);
    for (let i = 0; i < positions.length / 3; i++) {
      attributes.set([normals[3*i], normals[3*i+1], normals[3*i+2], uv[2*i], uv[2*i+1]], 5*i);
    }
    const [indices] = MeshoptSimplifier.simplifyWithAttributes(
      read(primitive.indices), positions, 3, attributes, 5, [.18, .18, .18, .03, .03],
      null, Math.min(oldAccessors[primitive.indices].count, Math.round(triangleBudgets[gltf.materials[primitive.material].name] * budgetScale) * 3), .009, ['Permissive']
    );
    const [remap, count] = MeshoptSimplifier.compactMesh(indices);
    if (count > 65535) throw Error('City mesh exceeds 16-bit index range');
    for (const [kind, index] of Object.entries(primitive.attributes)) {
      const original = read(index);
      const components = oldAccessors[index].type === 'VEC2' ? 2 : 3;
      const color = kind === 'COLOR_0';
      const stride = color ? 4 : components;
      const output = color ? new Uint8Array(count * stride) : new Float32Array(count * stride);
      for (let i = 0; i < remap.length; i++) {
        const target = remap[i];
        if (target >= count) continue;
        for (let k = 0; k < components; k++) {
          const value = original[i * components + k];
          output[target * stride + k] = color ? Math.round(255 * value) : value;
        }
        if (color) output[target * stride + 3] = 255;
      }
      if (color) {
        primitive.attributes[kind] = gltf.accessors.push({
          type: 'VEC4', count, normalized: true, componentType: 5121, bufferView: append(Buffer.from(output), 34962)
        }) - 1;
      } else {
        primitive.attributes[kind] = addAccessor(oldAccessors[index], output, 34962, 5126, count);
      }
      if (kind === 'POSITION') {
        const accessor = gltf.accessors[primitive.attributes[kind]];
        accessor.min = [Infinity, Infinity, Infinity];
        accessor.max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < output.length; i++) {
          const axis = i % 3;
          accessor.min[axis] = Math.min(accessor.min[axis], output[i]);
          accessor.max[axis] = Math.max(accessor.max[axis], output[i]);
        }
      }
    }
    primitive.indices = addAccessor(oldAccessors[primitive.indices], Uint16Array.from(indices), 34963, 5123, indices.length);
  }

  for (const image of gltf.images) {
    const view = oldViews[image.bufferView];
    const input = binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
    const jpeg = spawnSync('ffmpeg', ['-loglevel', 'error', '-i', 'pipe:0', '-f', 'image2pipe',
      '-vcodec', 'mjpeg', '-pix_fmt', 'yuvj444p', '-q:v', '3', 'pipe:1'], {input});
    if (jpeg.error || jpeg.status !== 0) throw jpeg.error || Error(jpeg.stderr.toString());
    image.bufferView = append(jpeg.stdout);
    image.mimeType = 'image/jpeg';
  }
  gltf.buffers = [{byteLength: offset}];
  gltf.asset.generator = 'New Babylon · courtyard house, city mesh';
  const json = Buffer.from(JSON.stringify(gltf));
  const paddedLength = (json.length + 3) & ~3;
  const header = Buffer.alloc(28 + paddedLength, 32);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(header.length + offset, 8);
  header.writeUInt32LE(paddedLength, 12);
  header.write('JSON', 16);
  json.copy(header, 20);
  header.writeUInt32LE(offset, 20 + paddedLength);
  header.write('BIN\0', 24 + paddedLength);
  fs.writeFileSync(destination, Buffer.concat([header, ...chunks]));
}

build(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
