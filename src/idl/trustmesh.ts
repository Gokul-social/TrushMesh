import type { Idl } from "@coral-xyz/anchor";
import trustmeshIdlJson from "./trustmesh.json" with { type: "json" };

export const trustmeshIdl = trustmeshIdlJson as Idl;
export type TrustmeshIdl = typeof trustmeshIdlJson;
