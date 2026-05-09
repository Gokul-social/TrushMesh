import { buildServer } from "../src/server.js";

const appPromise = buildServer({ disableWebsocket: true });

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  await app.ready();
  app.server.emit("request", req, res);
}
