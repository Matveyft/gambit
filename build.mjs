import { build } from "esbuild";
await build({
  entryPoints:["src/main.tsx"],bundle:true,minify:true,jsx:"automatic",
  target:"es2022",outfile:"docs/game.js",define:{"process.env.NODE_ENV":'"production"'}
});