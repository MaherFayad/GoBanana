/** Live wiring for the uploads routes: Drizzle repo, R2 binding, plan from the database. */
import { getRepos } from "@/lib/db";
import { authenticateUploadCaller } from "./auth";
import { getUploadsBucket } from "./bucket";
import { createDbUploadRepo } from "./db";
import { buildUploadsRoute } from "./http";

let route: ReturnType<typeof buildUploadsRoute> | undefined;

export function uploadsRoute(): ReturnType<typeof buildUploadsRoute> {
  route ??= buildUploadsRoute({
    repo: createDbUploadRepo(),
    bucket: getUploadsBucket,
    getPlan: (userId) => getRepos().users.getPlan(userId),
    authenticate: authenticateUploadCaller,
  });
  return route;
}
