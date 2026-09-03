import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getInternalUserById } from "../db";
import { readInternalSession } from "../internalAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const internalUserId = await readInternalSession(opts.req.headers.cookie);
  if (internalUserId) user = (await getInternalUserById(internalUserId)) ?? null;

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
