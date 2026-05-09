import type { FastifyInstance } from "fastify";
import { handleWebsocketConnection } from "./handler.js";

export async function registerWebsocketRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket, request) => {
    await handleWebsocketConnection(app, socket, request);
  });
}
