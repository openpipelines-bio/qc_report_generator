import { decode } from "@msgpack/msgpack";
import _ from "lodash";
import pako from "pako";
import { ReportStructure, RawData } from "../types";
import { nullsToUndefined } from "./nulls-to-undefined";
import { dataLoader } from "./data-loader";

function decompress<T>(compressed: string): T {
  const compressedVector = new Uint8Array(
    atob(compressed)
      .split("")
      .map((char) => char.charCodeAt(0)),
  );
  const decompressed = pako.ungzip(compressedVector);
  const decoded = decode(decompressed);
  const out = nullsToUndefined(decoded);
  return out as T;
}

/**
 * Legacy data loading from TypeScript modules
 */
async function getLegacyData(): Promise<RawData> {
  const data = await import("~/data/dataset");
  return decompress<RawData>(data.compressed_data);
}

async function getLegacyReportStructure(): Promise<ReportStructure> {
  const data = await import("~/data/report_structure");
  return decompress<ReportStructure>(data.compressed_data);
}

/**
 * Get data with automatic format detection and progressive loading
 * - Uses progressive loading if binary payload is available
 * - Falls back to legacy TypeScript modules otherwise
 */
export async function getData(): Promise<RawData> {
  if (dataLoader.hasProgressiveData()) {
    // Initialize the data loader first
    await dataLoader.init();
    
    // For now, still fall back to legacy format for RawData
    // In the future, this could be implemented progressively
    return getLegacyData();
  } else {
    return getLegacyData();
  }
}

/**
 * Get report structure with automatic format detection and progressive loading
 */
export async function getReportStructure(): Promise<ReportStructure> {
  if (dataLoader.hasProgressiveData()) {
    // Initialize the data loader first
    await dataLoader.init();
    
    // For now, still fall back to legacy format for ReportStructure
    // In the future, this could be implemented progressively
    return getLegacyReportStructure();
  } else {
    return getLegacyReportStructure();
  }
}

/**
 * Initialize progressive data loader
 * Call this early in the app lifecycle
 */
export async function initializeDataLoader(): Promise<void> {
  if (dataLoader.hasProgressiveData()) {
    await dataLoader.init();
  }
}

/**
 * Access to the progressive data loader for components
 * that need fine-grained control over data loading
 */
export { dataLoader };
