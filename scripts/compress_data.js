import fs from "fs";
import pako from "pako";
import { encode } from "@msgpack/msgpack";

// Get input and output file paths from command line arguments
const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3];

if (!inputFilePath || !outputFilePath) {
  console.error("Please provide input and output file paths.");
  process.exit(1);
}

// create output directory if it doesn't exist
const outputDir = outputFilePath.substring(0, outputFilePath.lastIndexOf("/"));
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Compressing ${inputFilePath}...`);
const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

const compressed = pako.gzip(encode(data));
const encoded = Buffer.from(compressed).toString("base64");

fs.writeFileSync(outputFilePath, `export const compressed_data = "${encoded}";`);
