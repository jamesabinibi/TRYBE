# Gryndee AWS Cost Optimization & Zero-Cost Migration Guide

## 1. Why Your Current AWS Bill is ~$43–$48 / Month (~₦60,000–₦72,000 NGN)

AWS uses enterprise pricing that charges **24/7 fixed baseline costs** regardless of user traffic:

| Service | Why AWS Charges You | Typical Monthly Cost |
| :--- | :--- | :--- |
| **AWS App Runner** | Charges $0.007/GB-hr for provisioned container memory 24 hours/day even with 0 traffic + vCPU on requests | **$22.68 – $24.00** |
| **AWS RDS (PostgreSQL)** | `db.t3.micro` instance running 730 hours/month ($0.017/hr) + 20 GB GP2/GP3 storage ($2.30) + automated backup snapshots | **$15.00 – $18.00** |
| **AWS VPC Public IPv4** | Starting Feb 2024, AWS charges $0.005/hr for *every* in-use public IPv4 address (your RDS public endpoint) | **$3.65 – $4.00** |
| **AWS Route 53** | $0.50/mo per hosted zone + DNS query volume fees | **$1.50 – $1.63** |
| **AWS S3 & SES** | Modest object storage requests and outbound transactional emails | **$0.10 – $0.50** |
| **TOTAL** | | **~$43.00 – $48.00 / month (~₦65,000 NGN)** |

---

## 2. Comparison of Cost-Cutting Architectures

### Option A: The 100% Free Tier Stack ($0.00 / Month = ₦0)
- **Database**: **Supabase** or **Neon.tech** (Free Tier: 500 MB PostgreSQL, SSL, automated backups, zero sleep).
- **Compute / Hosting**: **Render.com** (Free Web Service) or **Fly.io**.
- **Images / Files**: **Cloudinary** (25 GB free managed media) or **Cloudflare R2** (10 GB free, $0 bandwidth fees).
- **DNS & CDN**: **Cloudflare DNS** ($0 forever, replaces Route 53, includes free SSL & DDoS mitigation).
- **Email**: **Resend** (3,000 free emails/mo) or keep **AWS SES** (~$0.05/mo).
- **Total: $0.00 / month**.

### Option B: The $5 / Month Production Stack (~₦7,500 NGN / Month) — **RECOMMENDED**
- **Hosting**: **Railway.app** ($5/month Hobby plan)
  - Unlike free tiers, the app never sleeps or idles.
  - Full WebSocket support for Gryndee live chat & real-time notifications.
  - Zero server maintenance, automatic GitHub deployments.
- **Database**: **Neon.tech** or **Supabase** (Free Tier $0/mo) or Railway PostgreSQL.
- **DNS**: **Cloudflare** ($0/mo).
- **Storage**: **Cloudflare R2** or **Cloudinary** ($0/mo).
- **Total: $5.00 / month** (Saves over 88% compared to AWS).

### Option C: Single Cloud VPS ($3.50 / Month)
- **Hetzner Cloud VPS** (CX22: €3.29/mo ≈ $3.50/mo) or **AWS Lightsail** ($3.50/mo flat, no separate IPv4 fee).
- Run Docker + Node.js + PostgreSQL all on one machine with Coolify.

---

## 3. Step-by-Step Migration Guide (Save Your Data & Stop AWS Bills)

### Step 1: Create a Free PostgreSQL Database ($0/mo)
1. Go to [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com) and create a free account.
2. Create a new project named `gryndee`.
3. Copy your database connection string, which will look like:
   `postgresql://neondb_owner:xyz123@ep-cool-forest.us-east-2.aws.neon.tech/neondb?sslmode=require`
   or:
   `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxx.supabase.co:5432/postgres`

### Step 2: Migrate Your Data Using the Built-In Script
We have included a migration script `migrate-db.ts` that transfers all tables and existing data automatically:

```bash
# In your project root terminal:
DEST_DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require" npx tsx migrate-db.ts
```
*(Alternatively, you can export using `pg_dump -h gryndee-db.cevskqcic97b.us-east-1.rds.amazonaws.com -U postgres -d postgres > backup.sql` and restore via `psql "YOUR_NEW_URL" < backup.sql`)*.

### Step 3: Deploy Compute to Railway or Render

#### To deploy on Railway ($5/mo, 24/7 no sleep):
1. Go to [Railway.app](https://railway.app), connect your GitHub repository.
2. In the Service Variables, add:
   - `DATABASE_URL`: `your_neon_or_supabase_url`
   - `JWT_SECRET`: your secret key
   - `APP_URL`: `https://your-custom-domain.com`
   - `GEMINI_API_KEY`: your gemini key
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (if using Cloudinary)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for email)
3. Railway automatically detects `npm run build && npm start` and deploys in under 2 minutes.

#### To deploy on Render (100% Free):
1. Go to [Render.com](https://render.com) -> New -> Web Service.
2. Connect your repo and set:
   - Build Command: `npm install --legacy-peer-deps && npm run build`
   - Start Command: `npm start`
   - Add Environment Variables (same as above).

### Step 4: Transfer DNS from Route 53 to Cloudflare ($0/mo)
1. Create a free account at [Cloudflare.com](https://cloudflare.com).
2. Add your domain (e.g. `gryndee.com`). Cloudflare will import your existing DNS records automatically.
3. In your domain registrar (where you purchased the domain, e.g. Namecheap, GoDaddy, Whogohost), change nameservers to Cloudflare's 2 assigned nameservers.
4. Point your `@` and `www` CNAME records to your new Render/Railway app URL.

---

## 4. How to Safely Turn Off AWS Resources (Stop The Bill Immediately)

Once you have verified that your app is running on the new stack:

1. **Delete AWS App Runner**:
   - Open AWS Console -> **AWS App Runner** -> Select your service (`pa6brvdnhc`) -> Actions -> **Delete**.
   - *Instantly saves ~$23/month*.

2. **Terminate AWS RDS**:
   - Open AWS Console -> **Amazon RDS** -> Databases -> Select `gryndee-db`.
   - Actions -> **Delete**.
   - (Uncheck "Create final snapshot" if you already migrated your data, or create one for safety).
   - *Instantly saves ~$18/month + $3.65 IPv4 fee*.

3. **Delete Route 53 Hosted Zone**:
   - Open AWS Console -> **Route 53** -> Hosted zones -> Select your domain -> **Delete hosted zone**.
   - *Saves ~$1.63/month*.

4. **Delete unused Elastic IPs / VPC endpoints**:
   - Open AWS Console -> **VPC** -> **Elastic IPs** -> Check if any IP is allocated -> Actions -> **Release Elastic IP**.
   - *Prevents hidden IPv4 hourly fees*.
