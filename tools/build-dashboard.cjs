const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const result = await esbuild.build({
    entryPoints: ["src/dashboard.js"],
    outfile: "assets/js/dashboard.js",
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "linked",
    metafile: true,
    banner: { js: "/* Third-party licenses: dashboard.LICENSE.txt */" },
  });
  const licenses = new Map();
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.includes("node_modules/")) continue;
    let dir = path.dirname(path.resolve(input));
    while (dir !== path.dirname(dir)) {
      const manifest = path.join(dir, "package.json");
      if (fs.existsSync(manifest)) {
        const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
        if (pkg.name && pkg.version) {
          const license = fs
            .readdirSync(dir)
            .find((file) => /^licen[cs]e(?:\.md|\.txt)?$/i.test(file));
          if (!license)
            throw new Error("Missing dependency license: " + pkg.name);
          licenses.set(
            pkg.name,
            `${pkg.name} ${pkg.version}\n\n${fs.readFileSync(path.join(dir, license), "utf8").replace(/\r\n/g, "\n")}`,
          );
          break;
        }
      }
      dir = path.dirname(dir);
    }
  }
  fs.writeFileSync(
    "assets/js/dashboard.LICENSE.txt",
    [...licenses.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value)
      .join("\n\n----\n\n") + "\n",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
