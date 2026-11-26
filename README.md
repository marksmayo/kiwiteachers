# KiwiTeachers

Short, printable (1–4 page) teaching resources for Aotearoa New Zealand classrooms, from New Entrants to Year 13.

- **Browse & search**: full-text search over titles, descriptions and keywords, with filters for year level, learning area and resource type.
- **Watermarked previews**: anyone can preview a resource. Visitors who aren't signed in get a PDF with the watermark stamped in on the server, so the clean file never reaches them.
- **Free accounts**: signed-in teachers see and download the clean PDF.
- **Favourites**: signed-in teachers can save resources.
- **Admin uploads**: admins (set by `ADMIN_EMAILS`) upload PDFs and tag them with years, learning areas, type and keywords.

## Stack

- Next.js 16 (App Router, Cache Components) + Tailwind CSS 4
- Neon Postgres (Vercel Marketplace), which holds the data and runs search (`tsvector` + `pg_trgm`)
- Vercel Blob (private store) for the PDFs and thumbnails
- Better Auth (email + password, with users stored in Postgres)
- `pdf-lib` for server-side watermarking, `react-pdf` for the in-browser viewer

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (provisioned by the integration) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store (provisioned) |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `ADMIN_EMAILS` | Comma-separated emails that get admin (upload/manage) access |
| `BETTER_AUTH_URL` | Optional. Overrides the auto-detected site URL |

## Local development

```bash
vercel env pull .env.local
npm install
npm run db:migrate   # Better Auth tables + app tables (idempotent)
npm run dev
```

## Becoming an admin

Sign up on the site with an email listed in `ADMIN_EMAILS`. You'll then see **Manage resources** and **Upload resource** in the account menu.
