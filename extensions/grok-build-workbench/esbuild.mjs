import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: "dist/extension.cjs",
  external: ["vscode"],
  sourcemap: production ? false : "inline",
  minify: production,
  logLevel: "info"
});

if (watch) {
  await context.watch();
  console.log("Watching Grok Build Workbench sources…");
} else {
  await context.rebuild();
  await context.dispose();
}
