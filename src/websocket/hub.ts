import { jobChannel } from "../lib/constants.js";
import type { RedisLike } from "../services/redis.js";

type SocketLike = {
  send(payload: string): void;
  on(event: "close", listener: () => void): void;
  readyState?: number;
};

export class WebSocketHub {
  private readonly clients = new Map<string, Set<SocketLike>>();
  private readonly subscribedJobs = new Set<string>();

  constructor(private readonly redisSub: RedisLike) {
    this.redisSub.on?.("message", (...args: unknown[]) => {
      const [channel, message] = args as [string, string];
      const jobId = channel.replace(/^trustmesh:job:/, "");
      this.broadcastLocal(jobId, message);
    });
  }

  async add(jobId: string, socket: SocketLike) {
    let sockets = this.clients.get(jobId);
    if (!sockets) {
      sockets = new Set<SocketLike>();
      this.clients.set(jobId, sockets);
    }
    sockets.add(socket);

    if (!this.subscribedJobs.has(jobId) && this.redisSub.subscribe) {
      await this.redisSub.subscribe(jobChannel(jobId));
      this.subscribedJobs.add(jobId);
    }

    socket.on("close", () => {
      sockets?.delete(socket);
      if (sockets?.size === 0) {
        this.clients.delete(jobId);
      }
    });
  }

  broadcastLocal(jobId: string, payload: string) {
    const sockets = this.clients.get(jobId);
    if (!sockets) {
      return;
    }
    for (const socket of sockets) {
      if (socket.readyState === 1 || socket.readyState === undefined) {
        socket.send(payload);
      }
    }
  }
}
