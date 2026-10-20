import type { Kit } from "../kit";
import type { Skin } from "../inner";
import cobalt from "./cobalt";
import ultramarine from "./ultramarine";
import prism from "./prism";
import bento from "./bento";
import meadow from "./meadow";
import studio from "./studio";

/** A design family's own renderers. Each returns the slide background colour.
 * Families without a module fall back to the shared cover/closing/inner code. */
export type FamilyModule = {
  cover?: (k: Kit) => string;
  closing?: (k: Kit) => string;
  skin?: Skin;
};

export const familyModules: Record<string, FamilyModule> = {
  "cobalt": cobalt,
  "ultramarine": ultramarine,
  "prism": prism,
  "bento": bento,
  "meadow": meadow,
  "studio": studio,
};
