let r;
var h = (o) => {
    if (!r) {
        const n = o.forwardRef(({color: t = "currentColor", size: e = 24, ...i}, s) => {
            return o.createElement("svg", {ref: s, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: t, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...i}, o.createElement("polyline", {points: "9 18 15 12 9 6"}));
        });
        n.displayName = "ChevronRight",r = n;
    }
    return r;
};
const __FramerMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {framerContractVersion: "1"}}, __FramerMetadata__: {type: "variable"}}};
export { __FramerMetadata__, h as default };