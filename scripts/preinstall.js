const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

["package-lock.json", "yarn.lock"].forEach((f) => {
  const fp = path.join(root, f);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
});

const agent = process.env.npm_config_user_agent || "";
if (!agent.startsWith("pnpm")) {
  console.error("Use pnpm instead of npm or yarn.");
  process.exit(1);
}
