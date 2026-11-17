import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MULTIPART_THRESHOLD = 64 * 1024 * 1024;
const MULTIPART_PART_SIZE = 16 * 1024 * 1024;

const OBJECT_KEY_PATTERN =
  /^(originals\/[0-9a-f-]{36}\/source\.mp4|clips\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/highlight-[1-9][0-9]*\.mp4)$/i;

export function validateR2ObjectKey(key: string) {
  if (!OBJECT_KEY_PATTERN.test(key)) {
    throw new Error("Invalid R2 object key");
  }

  return key;
}

export function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing Cloudflare R2 credentials");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getR2Bucket() {
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new Error("Missing R2_BUCKET_NAME");
  }

  return bucket;
}

export async function downloadR2ObjectToFile(
  key: string,
  destinationPath: string,
  expectedSize?: number
) {
  validateR2ObjectKey(key);

  if (
    expectedSize !== undefined &&
    (!Number.isSafeInteger(expectedSize) || expectedSize <= 0)
  ) {
    throw new Error("Invalid expected object size");
  }

  await fs.mkdir(path.dirname(destinationPath), {
    recursive: true,
  });

  try {
    const result = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
      })
    );

    if (!result.Body || !(result.Body instanceof Readable)) {
      throw new Error("R2 did not return a Node.js readable stream");
    }

    if (
      expectedSize !== undefined &&
      result.ContentLength !== undefined &&
      result.ContentLength !== expectedSize
    ) {
      throw new Error("R2 source size does not match the upload record");
    }

    await pipeline(
      result.Body,
      createWriteStream(destinationPath, { flags: "wx" })
    );

    const downloaded = await fs.stat(destinationPath);

    if (
      expectedSize !== undefined &&
      downloaded.size !== expectedSize
    ) {
      throw new Error("Downloaded source size is incomplete");
    }

    return {
      path: destinationPath,
      size: downloaded.size,
      contentType: result.ContentType,
    };
  } catch (error) {
    await fs.rm(destinationPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function uploadMultipartFile(
  key: string,
  filePath: string,
  fileSize: number,
  contentType: string
) {
  const client = getR2Client();
  const bucket = getR2Bucket();
  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  );

  if (!created.UploadId) {
    throw new Error("R2 did not return a multipart upload ID");
  }

  const parts: CompletedPart[] = [];

  try {
    for (
      let start = 0, partNumber = 1;
      start < fileSize;
      start += MULTIPART_PART_SIZE, partNumber++
    ) {
      const end = Math.min(
        start + MULTIPART_PART_SIZE,
        fileSize
      );
      const uploaded = await client.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: created.UploadId,
          PartNumber: partNumber,
          ContentLength: end - start,
          Body: createReadStream(filePath, {
            start,
            end: end - 1,
          }),
        })
      );

      if (!uploaded.ETag) {
        throw new Error(`R2 did not return ETag for part ${partNumber}`);
      }

      parts.push({
        PartNumber: partNumber,
        ETag: uploaded.ETag,
      });
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: created.UploadId,
        MultipartUpload: { Parts: parts },
      })
    );
  } catch (error) {
    await client
      .send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: created.UploadId,
        })
      )
      .catch(() => {});

    throw error;
  }
}

export async function uploadFileToR2(
  key: string,
  filePath: string,
  contentType = "video/mp4"
) {
  validateR2ObjectKey(key);

  const file = await fs.stat(filePath);

  if (!file.isFile() || file.size <= 0) {
    throw new Error("Upload source must be a non-empty file");
  }

  if (file.size >= MULTIPART_THRESHOLD) {
    await uploadMultipartFile(
      key,
      filePath,
      file.size,
      contentType
    );
  } else {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: file.size,
        ContentType: contentType,
      })
    );
  }

  return {
    key,
    size: file.size,
    contentType,
  };
}

export async function createR2DownloadUrl(
  key: string,
  expiresIn = 300
) {
  validateR2ObjectKey(key);

  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 900) {
    throw new Error("Invalid signed URL expiry");
  }

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
    }),
    { expiresIn }
  );
}