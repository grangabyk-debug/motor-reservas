import {brotliDecompressSync} from "node:zlib";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";

const comandaRoot=join(dirname(fileURLToPath(import.meta.url)),"..");
const sourceDir=join(comandaRoot,".generated");
const output=join(comandaRoot,"components/ComandaFinal.jsx");
const encoded=[1,2,3,4,5].map(n=>readFileSync(join(sourceDir,`ComandaFinal.part${n}`),"utf8").trim()).join("");
const source=brotliDecompressSync(Buffer.from(encoded,"base64")).toString("utf8");
if(!source.includes("export default function ComandaFinal"))throw new Error("Fuente final de Comanda Llena inválida.");
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,source,"utf8");
console.log(`Comanda Llena: frontend final materializado (${source.length} bytes).`);
