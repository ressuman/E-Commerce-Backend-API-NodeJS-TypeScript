import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";

const files = globSync("dist/**/*.js");

files.forEach((file) => {
  const content = readFileSync(file, "utf-8");
  const updated = content.replace(/from (['"])(.*)\.ts\1/g, "from $1$2.js$1");
  writeFileSync(file, updated);
});
