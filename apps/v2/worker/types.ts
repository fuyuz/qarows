import type { Env } from "./env";
import type { AuthUser } from "./auth";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
    requestId: string;
  };
};
