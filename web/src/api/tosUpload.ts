// tosUpload.ts —— 浏览器侧直传火山引擎 TOS (S3 兼容)
//
// 镜像 docs/seedance_sucai/upload_seegen_assets.py 中 _upload_via_presigned() 的 AWS
// Signature Version 4 算法,差别只在:
//   - HMAC / SHA-256 走 cryptoCompat (Web Crypto 优先,裸 HTTP 时回退纯 JS),
//     避免在 http://公网IP 上 crypto.subtle === undefined 时报
//     「Cannot read properties of undefined (reading 'digest')」
//   - 浏览器自动设置 Host 请求头,所以 fetch 时不要再 manually 加 Host
//     (Host 仍在 canonicalHeaders 里参与签名;TOS 收到请求时 Host 由 URL 决定,
//      和我们签名时使用的值一致)
//
// ⚠ AK/SK 是火山主账号凭据,绝不硬编码进前端 bundle。只从环境变量读取:
//   VITE_TOS_AK / VITE_TOS_SK —— 必填(放 web/.env.local 或部署时注入,勿提交仓库)
//   VITE_TOS_BUCKET / VITE_TOS_ENDPOINT / VITE_TOS_REGION —— 可选,有非敏感默认值
//
// ⚠ TOS 桶必须开启 CORS:
//   - AllowedOrigin: 部署域名 (开发: http://localhost:5173, 生产: 你的访问地址)
//   - AllowedMethods: PUT, GET
//   - AllowedHeaders: *
//   - ExposeHeaders: ETag
// 控制台路径: TOS → 桶 → 权限管理 → 跨域规则。否则浏览器 PUT 会被 CORS 拦死。

// 非敏感配置保留默认值(桶名 / 域名 / 区域不是密钥)
const BUILTIN_TOS_BUCKET = "face-bucket-metamind";
const BUILTIN_TOS_ENDPOINT = "tos-s3-cn-hongkong.volces.com";
const BUILTIN_TOS_REGION = "cn-hongkong";

// 密钥仅从环境变量读取,缺失则为空(上传时报错提示配置)
const TOS_AK = (import.meta.env.VITE_TOS_AK as string | undefined) || "";
const TOS_SK = (import.meta.env.VITE_TOS_SK as string | undefined) || "";
const TOS_BUCKET =
  (import.meta.env.VITE_TOS_BUCKET as string | undefined) || BUILTIN_TOS_BUCKET;
const TOS_ENDPOINT =
  (import.meta.env.VITE_TOS_ENDPOINT as string | undefined) ||
  BUILTIN_TOS_ENDPOINT;
const TOS_REGION =
  (import.meta.env.VITE_TOS_REGION as string | undefined) || BUILTIN_TOS_REGION;

import {
  bufToHex,
  deriveSigningKey,
  hmacSha256Raw,
  sha256Hex,
} from "./cryptoCompat";

const enc = new TextEncoder();

// ─────────── 主入口 ───────────

export interface TosUploadResult {
  url: string;
  objectKey: string;
}

export interface TosUploadOptions {
  /** 自定义 object key(可选);默认 seedance_avatars/YYYYMMDD/<ts>_<safeName> */
  objectKey?: string;
  /** 子目录前缀(可选);默认 seedance_avatars */
  prefix?: string;
}

/** 把单个 File 直传到 TOS,返回公网 URL */
export async function uploadFileToTos(
  file: File,
  opts: TosUploadOptions = {},
): Promise<TosUploadResult> {
  if (!TOS_AK || !TOS_SK) {
    throw new Error(
      "TOS 凭据未配置:请在 web/.env.local 设置 VITE_TOS_AK / VITE_TOS_SK(或部署时注入)后重试。",
    );
  }
  const fileBuf = await file.arrayBuffer();
  const fileName = file.name;
  const contentType = file.type || "application/octet-stream";

  // 时间戳(UTC)
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = now.getUTCDate().toString().padStart(2, "0");
  const HH = now.getUTCHours().toString().padStart(2, "0");
  const MM = now.getUTCMinutes().toString().padStart(2, "0");
  const SS = now.getUTCSeconds().toString().padStart(2, "0");
  const dateStamp = `${yyyy}${mm}${dd}`;
  const amzDate = `${dateStamp}T${HH}${MM}${SS}Z`;

  // 文件名安全化(SigV4 对非 ASCII 字符敏感),保留扩展名
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  const prefix = opts.prefix ?? "seedance_avatars";
  const objectKey =
    opts.objectKey ?? `${prefix}/${dateStamp}/${Date.now()}_${safeName}`;

  const host = `${TOS_BUCKET}.${TOS_ENDPOINT}`;
  const payloadHash = await sha256Hex(fileBuf);

  // canonical URI: 每一段都 URL-encode,但 '/' 保留
  const canonicalUri =
    "/" + objectKey.split("/").map(encodeURIComponent).join("/");

  // x-amz-acl: public-read —— SeeGen CreateAsset 需要能匿名 GET 这个 URL
  // 才能拉去做人脸/视频校验。如果省略,得依赖桶默认 ACL,否则 SeeGen 拿不到文件
  // → SeeGen 返回 400。参考脚本走 boto3 时 ExtraArgs={"ACL": "public-read"},等价。
  const acl = "public-read";

  // canonical headers 必须按字典序排列(参与签名)
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-acl:${acl}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders =
    "content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `PUT\n${canonicalUri}\n\n` +
    `${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${TOS_REGION}/s3/aws4_request`;
  const stringToSign =
    `${algorithm}\n${amzDate}\n${credentialScope}\n` +
    (await sha256Hex(enc.encode(canonicalRequest)));

  const signingKey = await deriveSigningKey(
    TOS_SK,
    dateStamp,
    TOS_REGION,
    "s3",
  );
  const signature = bufToHex(await hmacSha256Raw(signingKey, stringToSign));

  const authorization =
    `${algorithm} Credential=${TOS_AK}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${canonicalUri}`;

  // 浏览器自动设置 Host 头(根据 URL),这里不要再写 Host
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-acl": acl,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: fileBuf,
  });

  if (!(resp.status === 200 || resp.status === 204)) {
    let detail = "";
    try {
      detail = await resp.text();
    } catch {
      /* ignore */
    }
    throw new Error(
      `TOS PUT 失败 HTTP ${resp.status} ${resp.statusText}:\n${detail}\n` +
        `(常见原因: 桶未开 CORS / AK 失效 / 时间偏差 > 15min)`,
    );
  }

  return { url, objectKey };
}
