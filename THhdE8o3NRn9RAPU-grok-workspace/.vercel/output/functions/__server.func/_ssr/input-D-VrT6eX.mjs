import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { a as cn } from "./router-Byr47Ah9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/input-D-VrT6eX.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Input = (0, import_react.forwardRef)(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	ref,
	className: cn("h-11 w-full rounded-md bg-panel px-3 text-sm text-ink num shadow-[0_0_0_1px_var(--color-line)] placeholder:text-mist/60", "transition-[box-shadow] duration-150 ease-out", "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]", "disabled:opacity-40", className),
	...props
}));
Input.displayName = "Input";
//#endregion
export { Input as t };
