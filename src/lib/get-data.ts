import { decode } from "@msgpack/msgpack";
import _ from "lodash";
import pako from "pako";
import { DocumentDescription, RawData } from "../types";

function decompress<T>(compressed: string): T {
  const compressedVector = new Uint8Array(
    atob(compressed)
      .split("")
      .map((char) => char.charCodeAt(0)),
  );
  const decompressed = pako.ungzip(compressedVector);
  return decode(decompressed) as T;
}

export async function getData(): Promise<RawData> {
  const data = await import("~/data/dataset");
  return decompress<RawData>(data.compressed_data)
}

export async function getDocumentDescription(): Promise<DocumentDescription> {
  const data = await import("~/data/columns_cellranger")
  return decompress<DocumentDescription>(data.compressed_data);
}
