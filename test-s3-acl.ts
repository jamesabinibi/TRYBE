import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

async function run() {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: 'test-acl.txt',
      Body: 'test',
      ContentType: 'text/plain',
      ACL: 'public-read'
    });
    await s3Client.send(command);
    console.log("Success with ACL public-read");
  } catch (e) {
    console.error("Error with ACL:", e);
  }
}
run();
