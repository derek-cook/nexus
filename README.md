To install dependencies:

```bash
bun install
```

One-time setup for cached aircraft metadata db:

```bash
# download latest csv (~90mb, okay to delete), then create json cache (required on server)
bun run download-aircraft-db && bun run preprocess-aircraft-db
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
