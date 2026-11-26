# Testing

```bash
npm test               # run everything once
npm run test:watch     # watch mode
npm run test:coverage  # with coverage + threshold check
```

## How the tests work

- **Vitest** runs unit, integration and component tests.
- **PGlite** (Postgres compiled to WebAssembly) runs the real `db/schema.sql` in memory, including triggers, full-text search,
  arrays and the NZ timezone. Database tests never touch Neon. See `test/pglite.ts` for helpers (`createUser`, `createResource`, `resetDb`).
- `@vercel/blob` is replaced by an in-memory store (`test/blob-mock.ts`). Sessions are mocked per test.
- Component tests use Testing Library with `// @vitest-environment jsdom` at the top of the file.
- PDF fixtures, including malicious ones (JavaScript actions, attachments, fake encryption), come from `test/pdf-fixtures.ts`.

## Coverage ratchet → 95%

Coverage thresholds live in `vitest.config.mts` and only ever go **up**:

- Running `npm run test:coverage` locally rewrites the thresholds to the new, higher numbers when coverage improves
  (`autoUpdate`). Commit the updated config with your change.
- CI (`CI=true`) only *enforces* the thresholds, so a PR that lowers coverage fails.
- `src/lib/**` (business, security and data logic) has its own floor of **95%**.
- The project-wide target is **95%** for lines, statements, functions and branches.

**Rule of thumb:** every new module ships with tests, and every bug fix ships with a test that would have caught it.
The fastest wins toward 95% are the page components under `src/app/**` and the remaining client components.
