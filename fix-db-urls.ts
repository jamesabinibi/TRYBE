import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.AWS_DB_HOST,
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  user: process.env.AWS_DB_USER,
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    if (!bucket) {
      console.log("No bucket configured");
      return;
    }

    // Replace in system_settings (LANDING_CONFIG)
    const { rows: sysRows } = await pool.query("SELECT * FROM system_settings WHERE key = 'LANDING_CONFIG'");
    if (sysRows.length > 0) {
      let val = sysRows[0].value;
      const regex = new RegExp(`https://${bucket}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/`, 'g');
      if (regex.test(val)) {
        val = val.replace(regex, '/api/images/');
        await pool.query("UPDATE system_settings SET value = $1 WHERE key = 'LANDING_CONFIG'", [val]);
        console.log("Updated LANDING_CONFIG");
      }
    }

    // Replace in settings (logo_url)
    const { rows: setRows } = await pool.query("SELECT id, logo_url FROM settings WHERE logo_url LIKE $1", [`%${bucket}%`]);
    for (const row of setRows) {
      const newUrl = row.logo_url.replace(new RegExp(`https://${bucket}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/`), '/api/images/');
      await pool.query("UPDATE settings SET logo_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`Updated settings ${row.id}`);
    }

    // Replace in products (image)
    const { rows: prodRows } = await pool.query("SELECT id, image FROM products WHERE image LIKE $1", [`%${bucket}%`]);
    for (const row of prodRows) {
      const newUrl = row.image.replace(new RegExp(`https://${bucket}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/`), '/api/images/');
      await pool.query("UPDATE products SET image = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`Updated product ${row.id}`);
    }

    // Replace in product_images (image_data)
    const { rows: imgRows } = await pool.query("SELECT id, image_data FROM product_images WHERE image_data LIKE $1", [`%${bucket}%`]);
    for (const row of imgRows) {
      const newUrl = row.image_data.replace(new RegExp(`https://${bucket}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/`), '/api/images/');
      await pool.query("UPDATE product_images SET image_data = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`Updated product_image ${row.id}`);
    }

    // Replace in services (image_url)
    const { rows: srvRows } = await pool.query("SELECT id, image_url FROM services WHERE image_url LIKE $1", [`%${bucket}%`]);
    for (const row of srvRows) {
      const newUrl = row.image_url.replace(new RegExp(`https://${bucket}\\.s3\\.[a-z0-9-]+\\.amazonaws\\.com/`), '/api/images/');
      await pool.query("UPDATE services SET image_url = $1 WHERE id = $2", [newUrl, row.id]);
      console.log(`Updated service ${row.id}`);
    }

    console.log("Database update complete");
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
