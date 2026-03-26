export const UI_FONT_FAMILY = '"Bitter", "Georgia", serif';
export const CHINESE_FONT_FAMILY = '"STLiti", "LiSu", "Baoli SC", "Songti SC", serif';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createEmptyGrid(rows, cols, fill = null) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

export function algebraicFiles(count) {
  return Array.from({ length: count }, (_, index) => String.fromCharCode(97 + index));
}

export function renderGif({
  frames,
  delay,
  endDelay,
  filename,
  statusElement,
  previewElement,
  downloadButton,
  copyButton,
}) {
  return new Promise((resolve, reject) => {
    if (!frames.length) {
      reject(new Error("There are no frames to render."));
      return;
    }

    statusElement.textContent = "Rendering GIF...";
    downloadButton.disabled = true;
    copyButton.disabled = true;

    const gif = new window.GIF({
      workers: 2,
      quality: 8,
      width: frames[0].width,
      height: frames[0].height,
      workerScript: "./vendor-gif.worker.js",
    });

    frames.forEach((frame, index) => {
      const isFirst = index === 0;
      const isLast = index === frames.length - 1;
      gif.addFrame(frame, {
        delay: isFirst ? delay + 250 : isLast ? delay + endDelay : delay,
        copy: true,
      });
    });

    gif.on("finished", (blob) => {
      const url = URL.createObjectURL(blob);
      previewElement.src = url;
      previewElement.style.display = "block";
      statusElement.textContent = `GIF ready. ${frames.length} frame${frames.length === 1 ? "" : "s"} rendered.`;
      downloadButton.disabled = false;
      copyButton.disabled = false;
      downloadButton.onclick = () => {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
      };
      copyButton.onclick = async () => {
        if (!navigator.clipboard || typeof window.ClipboardItem === "undefined") {
          statusElement.textContent = "Clipboard copy is not supported in this browser. Download the GIF instead.";
          return;
        }
        try {
          await navigator.clipboard.write([
            new window.ClipboardItem({
              "image/gif": blob,
            }),
          ]);
          statusElement.textContent = "GIF copied to the clipboard.";
        } catch (error) {
          statusElement.textContent = "Clipboard copy failed. Download the GIF instead.";
        }
      };
      resolve({ blob, url });
    });

    gif.on("abort", () => reject(new Error("GIF rendering aborted.")));
    gif.on("error", (error) => reject(error instanceof Error ? error : new Error(String(error))));
    gif.render();
  });
}

export function enumerateLeafPaths(root) {
  const leaves = [];

  function visit(node, path) {
    const nextPath = node.id === "root" ? path : [...path, node];
    if (!node.children?.length) {
      leaves.push(nextPath);
      return;
    }
    node.children.forEach((child) => visit(child, nextPath));
  }

  visit(root, []);
  return leaves.length ? leaves : [[]];
}

export function describePath(path, formatter = (node) => node.label || node.move || node.id) {
  if (!path.length) {
    return "Main line";
  }
  const preview = path.slice(0, 6).map(formatter).join(" ");
  return path.length > 6 ? `${preview} ...` : preview;
}

export function syncRangeInputs(startInput, endInput, slider, total) {
  startInput.min = "0";
  startInput.max = String(total);
  endInput.min = "0";
  endInput.max = String(total);
  slider.min = "0";
  slider.max = String(total);
}

export function normalizeRange(start, end, total) {
  const safeStart = clamp(Number(start) || 0, 0, total);
  const safeEnd = clamp(Number(end) || total, safeStart, total);
  return { start: safeStart, end: safeEnd };
}

export function drawCropOverlay(ctx, metrics, crop, stroke = "rgba(167, 52, 35, 0.85)") {
  if (!crop) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(3, metrics.cell * 0.07);
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
  ctx.restore();
}

export function cropCanvas(sourceCanvas, cropRect, outputWidth = 720, outputHeight = 720) {
  if (!cropRect) {
    return sourceCanvas;
  }
  const output = document.createElement("canvas");
  output.width = outputWidth;
  output.height = outputHeight;
  const ctx = output.getContext("2d");
  ctx.fillStyle = "#f6ecd1";
  ctx.fillRect(0, 0, output.width, output.height);

  const scale = Math.min(output.width / cropRect.width, output.height / cropRect.height);
  const drawWidth = cropRect.width * scale;
  const drawHeight = cropRect.height * scale;
  const offsetX = (output.width - drawWidth) / 2;
  const offsetY = (output.height - drawHeight) / 2;
  ctx.drawImage(
    sourceCanvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );

  return output;
}

export function buildBranchOptions(selectElement, root, formatter) {
  const paths = enumerateLeafPaths(root);
  selectElement.innerHTML = "";
  paths.forEach((path, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Branch ${index + 1}: ${describePath(path, formatter)}`;
    selectElement.append(option);
  });
  return paths;
}

export function formatMoveList(items) {
  if (!items.length) {
    return "No moves loaded.";
  }
  return items
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

export function createBoardCanvas(width = 720, height = 720) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function fileIndexToLabel(index) {
  return String.fromCharCode(97 + index);
}

export function rankIndexToChessLabel(index) {
  return String(8 - index);
}

export function boardSquareName(x, y, size = 8) {
  return `${fileIndexToLabel(x)}${size - y}`;
}

export function parseNumeric(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
