import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`缺少环境变量 ${name}：请在 server/.env 中配置 R2 相关凭证`);
  }
  return value;
}

const endpoint = requireEnv("R2_ENDPOINT", process.env.R2_ENDPOINT);
const bucket = requireEnv("R2_BUCKET", process.env.R2_BUCKET);
// 结尾斜杠统一去掉，方便后面拼 URL 与反解 key
const publicUrl = requireEnv("R2_PUBLIC_URL", process.env.R2_PUBLIC_URL).replace(/\/+$/, "");

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY),
  },
});

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[mime.toLowerCase()] ?? "jpg";
}

/** 由对象 key 拼出可公开访问的 URL */
export function publicUrlForKey(key: string): string {
  return `${publicUrl}/${key}`;
}

/** 由公开 URL 反解出对象 key；非本桶地址返回 null */
export function keyFromPublicUrl(url: string): string | null {
  const prefix = `${publicUrl}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/** 上传衣物照片，返回公开访问 URL（库里只存这个 URL） */
export async function uploadClothPhoto(params: {
  userId: number;
  data: Buffer;
  contentType: string;
}): Promise<string> {
  const extension = extensionForMime(params.contentType);
  // 按用户分目录，key 用 UUID 避免文件名冲突与路径穿越
  const key = `clothes/${params.userId}/${randomUUID()}.${extension}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.data,
      ContentType: params.contentType,
    }),
  );

  return publicUrlForKey(key);
}

/** 删除照片；URL 不属于本桶时静默跳过，避免误删 */
export async function deletePhoto(url: string): Promise<void> {
  const key = keyFromPublicUrl(url);
  if (!key) return;

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
