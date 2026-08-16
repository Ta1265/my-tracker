import csv from "csv-parser";
import fs from "fs";

export async function readCSV(fileName: string): Promise<Array<any>> {
  return new Promise((resolve, reject) => {
    const results: Array<Transaction> = [];
    fs.createReadStream(fileName)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}