import _ from "lodash";

export function calculateBinCounts(
  values: number[], 
  actualMin: number, 
  actualMax: number, 
  numBins: number, 
  groupValues?: number[]
): { binCounts: number[], groupCounts?: number[][] } {
  const binSize = (actualMax - actualMin) / numBins;
  const binCounts = _.fill(Array(numBins + 2), 0);
  let groupCounts: number[][] | undefined = undefined;
  
  if (groupValues) {
    try {
      const uniqueGroups = Array.from(new Set(groupValues.filter(v => 
        Number.isFinite(v) && v >= 0 && v < 1000
      )));
      
      const groupMap = new Map(uniqueGroups.map((val, idx) => [val, idx]));
      const groupCount = groupMap.size;
      
      if (groupCount > 0) {
        groupCounts = Array(groupCount).fill(0).map(() => 
          Array(numBins + 2).fill(0)
        );
        
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          let bin = 0;
          
          if (v < actualMin) {
            bin = 0;
          } else if (v >= actualMax) {
            bin = numBins + 1;
          } else {
            bin = Math.floor((v - actualMin) / binSize) + 1;
          }
          
          binCounts[bin] += 1;
          
          const groupVal = groupValues[i];
          const groupIdx = groupMap.get(groupVal);
          
          if (groupIdx !== undefined && groupCounts) {
            groupCounts[groupIdx][bin] += 1;
          }
        }
      }
      
      return { binCounts, groupCounts };
    } catch (err) {
      console.error("Error in histogram grouping:", err);
    }
  }
  
  if (!groupValues || !groupCounts) {
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      let bin = 0;
      
      if (v < actualMin) {
        bin = 0;
      } else if (v >= actualMax) {
        bin = numBins + 1;
      } else {
        bin = Math.floor((v - actualMin) / binSize) + 1;
      }
      
      binCounts[bin] += 1;
    }
  }
  
  return { binCounts, groupCounts };
}

export function createBinLabels(
  counts: number[], 
  x0: number[], 
  x1: number[],
  roundFun: (v: number) => string,
  globalMin: number,
  globalMax: number,
  numBins: number
): string[] {
  return counts.map((count, i) => {
    const left = i === 0 ? globalMin : x0[i];
    const right = i === numBins + 1 ? globalMax : x1[i];
    return `[${roundFun(left)}, ${roundFun(right)}): ${count}`;
  });
}
