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
  const data = await import("~/data/dataset_cb_imm");
  return decompress<RawData>(data.compressed_data)
}

export async function getReportStructure(): Promise<ReportStructure> {
  const data = await import("~/data/report_structure_cellranger");
  const reportStructure = decompress<ReportStructure>(data.compressed_data);
  
  // Convert nulls to undefined for cutoffs and zoom levels
  reportStructure.categories.forEach(category => {
    category.defaultFilters.forEach(filter => {
      if (filter.cutoffMin === null) filter.cutoffMin = undefined;
      if (filter.cutoffMax === null) filter.cutoffMax = undefined;
      if (filter.zoomMin === null) filter.zoomMin = undefined;
      if (filter.zoomMax === null) filter.zoomMax = undefined;
    });
  });
  
  return reportStructure;
}
