import { mkdir } from "node:fs/promises";
import { createApp } from "./app.js";
import { appConfig } from "./config.js";

await mkdir(appConfig.uploadDir, { recursive: true });
const app = createApp();
app.listen(appConfig.port, () => {
  console.log(
    `${appConfig.productName} API listening on :${appConfig.port} (uploads → ${appConfig.uploadDir})`,
  );
});
