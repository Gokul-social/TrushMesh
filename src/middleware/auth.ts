import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../lib/errors.js";

export type AuthenticatedUser = {
  id: string;
  walletAddr: string;
  solName: string | null;
};

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    authUser: AuthenticatedUser;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      const token = await request.jwtVerify<{ sub: string; walletAddr: string }>();
      const user = await app.services.prisma.user.findUnique({
        where: { id: token.sub },
        select: { id: true, walletAddr: true, solName: true }
      });

      if (!user || user.walletAddr !== token.walletAddr) {
        throw new AppError("UNAUTHORIZED", "Invalid authentication token");
      }

      request.authUser = {
        id: user.id,
        walletAddr: user.walletAddr,
        solName: user.solName
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("UNAUTHORIZED", "Missing or invalid authentication token");
    }
  });
});
