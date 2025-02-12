import fs from "fs";
import pako from "pako";
import { encode } from "@msgpack/msgpack";

const inputDir = "./data"

//iterate over all *.json files in the data directory
const inputFilePaths = fs.readdirSync(inputDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => `${inputDir}/${file}`);

for (const inputFilePath of inputFilePaths) {
  console.log(`Compressing ${inputFilePath}...`);
  const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

  const compressed = pako.gzip(encode(data));
  const encoded = Buffer.from(compressed).toString("base64");

  const baseName = inputFilePath.split('/').pop().split('.').shift();
  const destFile = `./src/data/${baseName}.ts`

  fs.writeFileSync(destFile, `export const compressed_data = "${encoded}";`);
}
