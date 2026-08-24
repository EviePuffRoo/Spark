import { app } from "./app.js";
import { scheduleBackups } from "./dbBackup.js";
import { initRealtimeBackbone } from "./worldEvents.js";

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Spark API listening on http://localhost:${port}`);
});

scheduleBackups();
initRealtimeBackbone();
