// CSS Painting API worklet — diagonal brutalist hatching used as the
// receipt-modal backdrop. Loaded via CSS.paintWorklet.addModule() in
// experiences.js when the API is supported; the body picks it up via
// `data-paint="hatch"` and `background: paint(brutalist-hatch)`.

class BrutalistHatch {
    static get inputProperties() {
        return ["--hatch-color", "--hatch-gap"];
    }
    paint(ctx, geom, props) {
        const color = (props.get("--hatch-color") || "").toString().trim() || "#4c4f6918";
        const gap = parseFloat(props.get("--hatch-gap")) || 9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        for (let i = -geom.height; i < geom.width; i += gap) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + geom.height, geom.height);
            ctx.stroke();
        }
    }
}

registerPaint("brutalist-hatch", BrutalistHatch);
