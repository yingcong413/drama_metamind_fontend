// cryptoCompat.ts —— SHA-256 / HMAC-SHA256 兼容封装
//
// 为什么需要它?
//   Web Crypto API (crypto.subtle) 只在「安全上下文」(secure context) 下可用:
//     - HTTPS 页面
//     - http://localhost / http://127.0.0.1
//   在裸 HTTP + 公网 IP / 域名访问时,crypto.subtle 是 undefined,
//   所以 tosUpload.ts 的 AWS SigV4 (依赖 SHA-256 + HMAC) 会抛
//   「Cannot read properties of undefined (reading 'digest')」。
//
// 这里的策略:
//   - 优先用 crypto.subtle (有就快、原生加速)
//   - 不可用时回退到纯 JS 实现 (FIPS 180-4 标准 SHA-256 + RFC 2104 HMAC)
//   - 对调用方暴露统一的 async API (sha256Hex / hmacSha256Raw / deriveSigningKey)
//
// 纯 JS 实现在 30MB 文件上大约 1-3 秒(取决于设备),线上裸 HTTP 用得起。
// 想要更快建议把站点切到 HTTPS,Web Crypto 自动接管。

const enc = new TextEncoder();

const hasWebCrypto: boolean =
  typeof crypto !== "undefined" &&
  typeof (crypto as Crypto).subtle !== "undefined" &&
  typeof (crypto as Crypto).subtle.digest === "function";

// ─────────── 通用工具 ───────────

export function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function bufSourceToBytes(data: BufferSource): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  // ArrayBufferView 其它子类型 (DataView / Int8Array / ...)
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

// ─────────── 纯 JS SHA-256 (FIPS 180-4) ───────────

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, k: number): number {
  return ((n >>> k) | (n << (32 - k))) >>> 0;
}

function sha256BytesJs(input: Uint8Array): Uint8Array {
  // 初始哈希值
  let h0 = 0x6a09e667 | 0;
  let h1 = 0xbb67ae85 | 0;
  let h2 = 0x3c6ef372 | 0;
  let h3 = 0xa54ff53a | 0;
  let h4 = 0x510e527f | 0;
  let h5 = 0x9b05688c | 0;
  let h6 = 0x1f83d9ab | 0;
  let h7 = 0x5be0cd19 | 0;

  // 预处理:补 1 个 0x80,补 0,最后 8 字节大端 bit 长度
  const len = input.length;
  const bitLen = len * 8;
  // 至少要给 9 字节余量 (0x80 + 8 字节长度),再向上对齐到 64 字节倍数
  const paddedLen = (((len + 9 + 63) >>> 6) << 6);
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  // 64-bit length, 高 32 位先(大端);JS number 上限 2^53,bitLen 实际不会溢出 2^32
  // 但保险起见还是分两段写
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  view.setUint32(paddedLen - 8, hi, false);
  view.setUint32(paddedLen - 4, lo, false);

  const W = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15];
      const w2 = W[t - 2];
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3;
    let e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

// ─────────── 纯 JS HMAC-SHA256 (RFC 2104) ───────────

function hmacSha256BytesJs(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const BLOCK = 64;
  let k = key;
  if (k.length > BLOCK) k = sha256BytesJs(k);
  if (k.length < BLOCK) {
    const padded = new Uint8Array(BLOCK);
    padded.set(k);
    k = padded;
  }
  const ipad = new Uint8Array(BLOCK);
  const opad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }
  const inner = new Uint8Array(BLOCK + msg.length);
  inner.set(ipad);
  inner.set(msg, BLOCK);
  const innerHash = sha256BytesJs(inner);
  const outer = new Uint8Array(BLOCK + innerHash.length);
  outer.set(opad);
  outer.set(innerHash, BLOCK);
  return sha256BytesJs(outer);
}

// ─────────── 对外 API (Web Crypto 优先,失败回退 JS) ───────────

export async function sha256Hex(data: BufferSource): Promise<string> {
  if (hasWebCrypto) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", data);
      return bufToHex(buf);
    } catch {
      // 极少数浏览器 subtle 存在但 digest 抛 NotSupportedError,继续降级
    }
  }
  const bytes = bufSourceToBytes(data);
  return bufToHex(sha256BytesJs(bytes));
}

export async function hmacSha256Raw(
  key: BufferSource,
  msg: string | BufferSource,
): Promise<ArrayBuffer> {
  const msgBytes =
    typeof msg === "string" ? enc.encode(msg) : bufSourceToBytes(msg);

  if (hasWebCrypto) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        // 新 TS lib 把 ArrayBufferLike 与 ArrayBuffer 分开,subtle 需要后者
        key as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      return crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        msgBytes as unknown as BufferSource,
      );
    } catch {
      /* 降级 */
    }
  }
  const keyBytes = bufSourceToBytes(key);
  const out = hmacSha256BytesJs(keyBytes, msgBytes);
  // 复制到独立 ArrayBuffer,避免 Uint8Array view 偏移以及 SharedArrayBuffer 类型分歧
  const buf = new ArrayBuffer(out.byteLength);
  new Uint8Array(buf).set(out);
  return buf;
}

/**
 * AWS SigV4 派生签名密钥:
 *   kDate    = HMAC("AWS4"+sk, dateStamp)
 *   kRegion  = HMAC(kDate, region)
 *   kService = HMAC(kRegion, service)
 *   kSigning = HMAC(kService, "aws4_request")
 */
export async function deriveSigningKey(
  sk: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256Raw(enc.encode("AWS4" + sk), dateStamp);
  const kRegion = await hmacSha256Raw(kDate, region);
  const kService = await hmacSha256Raw(kRegion, service);
  return hmacSha256Raw(kService, "aws4_request");
}

// 测试用:让测试代码也能跑纯 JS 路径
export const __testInternals = {
  sha256BytesJs,
  hmacSha256BytesJs,
  hasWebCrypto,
};
