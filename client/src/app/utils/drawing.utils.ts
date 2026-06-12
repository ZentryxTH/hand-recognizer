export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17] // MCP bridges
];

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  results: any,
  width: number,
  height: number,
  clientWidthVal?: number
) {
  if (!results.landmarks) return;

  const clientWidth = clientWidthVal || width;
  const scale = width / clientWidth;

  ctx.save();
  ctx.lineWidth = 1.5 * scale;

  for (const landmarks of results.landmarks) {
    // Draw skeleton lines using specified HAND_CONNECTIONS in cyan
    ctx.strokeStyle = '#00f2fe';
    for (const [start, end] of HAND_CONNECTIONS) {
      if (landmarks[start] && landmarks[end]) {
        ctx.beginPath();
        ctx.moveTo(landmarks[start].x * width, landmarks[start].y * height);
        ctx.lineTo(landmarks[end].x * width, landmarks[end].y * height);
        ctx.stroke();
      }
    }

    // Draw landmark points
    for (let idx = 0; idx < landmarks.length; idx++) {
      const lm = landmarks[idx];
      if (!lm) continue;
      const x = lm.x * width;
      const y = lm.y * height;

      if (idx === 0) {
        ctx.fillStyle = '#a855f7'; // Wrist: purple
      } else if (idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20) {
        ctx.fillStyle = '#ff2d55'; // Tips: pink
      } else {
        ctx.fillStyle = '#34c759'; // Joints: green
      }

      ctx.beginPath();
      ctx.arc(x, y, 3 * scale, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawCategoryLabels(
  ctx: CanvasRenderingContext2D,
  results: any,
  width: number,
  height: number,
  isFrontCamera: boolean = false,
  clientWidthVal?: number
) {
  if (!results.landmarks || !results.handedness) return;

  const clientWidth = clientWidthVal || width;
  const scale = width / clientWidth;
  const baseFontSize = clientWidth < 768 ? 16 : 14;
  const fontSize = Math.round(baseFontSize * scale);

  ctx.save();
  ctx.textBaseline = 'top';

  for (let i = 0; i < results.landmarks.length; i++) {
    const landmarks = results.landmarks[i];
    const handedness = results.handedness[i];
    const gesture = results.gestures?.[i];

    const wrist = landmarks?.[0];
    if (!wrist || !handedness) continue;

    // Position text overlay at the wrist (landmark 0)
    const x = wrist.x * width;
    const y = (wrist.y * height) + (15 * scale);

    let handLabel = handedness[0].categoryName;
    // Anatomically correct hand swap in front camera mode
    if (isFrontCamera) {
      handLabel = handLabel === 'Left' ? 'RIGHT' : 'LEFT';
    } else {
      handLabel = handLabel === 'Left' ? 'LEFT' : 'RIGHT';
    }

    const score = Math.round(handedness[0].score * 100);
    let displayText = `${handLabel} ${score}%`;
    if (gesture?.[0]) {
      displayText += ` - ${gesture[0].categoryName} (${Math.round(gesture[0].score * 100)}%)`;
    }

    ctx.textAlign = 'center';
    ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

    const textHeight = fontSize + (8 * scale);
    const textWidth = ctx.measureText(displayText).width;
    ctx.fillStyle = 'rgba(17, 18, 22, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1 * scale;
    drawRoundedRect(ctx, x - (textWidth / 2) - (8 * scale), y - (4 * scale), textWidth + (16 * scale), textHeight, 4 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(displayText, x, y);
  }
  ctx.restore();
}
