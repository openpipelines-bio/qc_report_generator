import { decode } from "@msgpack/msgpack";
import _ from "lodash";
import pako from "pako";
import { ReportStructure, RawData } from "../types";

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

export async function getReportStructure(): Promise<ReportStructure> {
  const data = await import("~/data/report_structure")
  return decompress<ReportStructure>(data.compressed_data);
}
