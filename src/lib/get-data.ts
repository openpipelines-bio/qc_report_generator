import { decode } from "@msgpack/msgpack";
import _ from "lodash";
import pako from "pako";
import { QCCategory, RawData } from "../types";

export async function getData(): Promise<RawData> {
  const compressedData = await import("~/data/dataset");
  const compressedVector = new Uint8Array(
    atob(compressedData.compressed_data)
      .split("")
      .map((char) => char.charCodeAt(0)),
  );
  const decompressed = pako.ungzip(compressedVector);
  return decode(decompressed) as RawData;
}

export async function getQCCategories(): Promise<QCCategory[]> {
  const out = await import("~/data/columns.json") as QCCategory[];
  return out
}
