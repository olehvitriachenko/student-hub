import { buildApp } from './app.ts';

const app = buildApp({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

const port = Number(process.env.PORT ?? 3000);
// 0.0.0.0 so a phone / emulator on the same network can reach the API.
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.fatal(err);
  process.exit(1);
});
