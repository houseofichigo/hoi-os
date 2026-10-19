import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import {
  resolve,
  relative,
  join,
  dirname,
  basename,
  sep,
  isAbsolute,
} from "node:path";
const inside = (base, path) => {
  const r = relative(base, path);
  return !r || (!isAbsolute(r) && r !== ".." && !r.startsWith(".." + sep));
};
function physical(path) {
  if (existsSync(path)) return realpathSync(path);
  if (lstatSync(path, { throwIfNoEntry: false }))
    throw Error("PACKAGE_OUTPUT_UNSAFE");
  return join(physical(dirname(path)), basename(path));
}
export function preparePackageOutput(root, requested) {
  if (!requested)
    throw Error(
      "PACKAGE_OUTPUT_REQUIRED: Supply --output <new directory>; historical release folders are never overwritten.",
    );
  const output = physical(resolve(requested)),
    product = realpathSync(root);
  if (existsSync(output))
    throw Error("PACKAGE_OUTPUT_EXISTS: Choose a new directory.");
  if (
    inside(output, product) ||
    (inside(product, output) &&
      !inside(join(product, "release"), output) &&
      !inside(join(product, ".local"), output))
  )
    throw Error(
      "PACKAGE_OUTPUT_OVERLAP: Keep candidates outside product sources.",
    );
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output, { mode: 0o700 });
  return output;
}
