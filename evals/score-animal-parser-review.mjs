import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {scoreAnimalParserReview} from "./parser-metrics.mjs";

const inputPath=path.resolve(process.argv[2]||"eval-results/animal-parser-review.jsonl");
const outputDirectory=path.resolve("eval-results");
const outputPath=path.join(outputDirectory,"animal-parser-score.json");
const contents=await readFile(inputPath,"utf8");
const rows=contents.split(/\r?\n/).filter(Boolean).map((line,index)=>{
  try {
    return JSON.parse(line);
  } catch(error) {
    throw new Error(`Invalid JSON on line ${index+1}: ${error instanceof Error?error.message:String(error)}`);
  }
});
const reviewed=rows.filter(row=>Array.isArray(row.reviewed_fields)&&row.reviewed_fields.length>0);
if(reviewed.length===0) {
  throw new Error("No reviewed fields found. Annotate expected values and reviewed_fields in the JSONL first.");
}

const report={
  sourceFile:path.basename(inputPath),
  recordsInFile:rows.length,
  recordsReviewed:reviewed.length,
  metrics:scoreAnimalParserReview(reviewed),
};
await mkdir(outputDirectory,{recursive:true});
await writeFile(outputPath,`${JSON.stringify(report,null,2)}\n`,"utf8");
console.log(JSON.stringify(report,null,2));
console.log(`Report saved to ${outputPath}`);
