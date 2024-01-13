import fs from 'fs';

const globalUnitToNameMap = globalThis as unknown as {
  unitToNameMap: { [key: string]: string } | undefined;
};
export const unitToNameMap =
  globalUnitToNameMap.unitToNameMap ??
  JSON.parse(fs.readFileSync('src/data/coinsUnitNameMap2.json', 'utf8'));

globalUnitToNameMap.unitToNameMap = unitToNameMap;
