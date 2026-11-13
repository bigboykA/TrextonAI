import "dotenv/config";

import {
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { getR2Client, getR2Bucket } from "./r2";

async function main() {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const key = "tests/hello-trexton.txt";

  // Upload an object
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: "Hello from Trexton AI!",
      ContentType: "text/plain",
    })
  );

  console.log("Upload successful!");

  // Verify that the object exists
  const result = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  console.log("Object size:", result.ContentLength);

  // Remove the test object
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  console.log("Test object deleted!");
}

main().catch((error) => {
  console.error("R2 test failed:", error);
  process.exitCode = 1;
});