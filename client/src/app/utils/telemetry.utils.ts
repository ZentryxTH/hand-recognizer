import { DetectedHand } from '../models/telemetry.interface';

// Calculate 3D Euclidean distance between two landmarks
function getDistance3D(p1: any, p2: any): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // Fallback to 0 if z is not provided by the model
  const dz = (p2.z || 0) - (p1.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Calculate 3D angle between three landmarks (p1-p2-p3, with p2 as the vertex)
function getAngle3D(p1: any, p2: any, p3: any): number {
  const v1x = p1.x - p2.x;
  const v1y = p1.y - p2.y;
  const v1z = (p1.z || 0) - (p2.z || 0);

  const v2x = p3.x - p2.x;
  const v2y = p3.y - p2.y;
  const v2z = (p3.z || 0) - (p2.z || 0);

  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosTheta) * (180 / Math.PI);
}

// A real-world, rotation-invariant check for an Open Palm.
// A finger is "extended" if the 3D angle at its middle joint is relatively straight (> 150 degrees).
// If it is curled, the angle will be much smaller (e.g., < 120 degrees).
function isOpenPalm(landmarks: any[]): boolean {
  if (!landmarks || landmarks.length < 21) return false;

  // We check the angle formed by: (Base Knuckle) -> (Middle Knuckle) -> (Tip)
  // For Thumb: MCP(2) -> IP(3) -> Tip(4)
  const thumbExtended = getAngle3D(landmarks[2], landmarks[3], landmarks[4]) > 140;

  // For Index: MCP(5) -> PIP(6) -> Tip(8)
  const indexExtended = getAngle3D(landmarks[5], landmarks[6], landmarks[8]) > 150;

  // For Middle: MCP(9) -> PIP(10) -> Tip(12)
  const middleExtended = getAngle3D(landmarks[9], landmarks[10], landmarks[12]) > 150;

  // For Ring: MCP(13) -> PIP(14) -> Tip(16)
  const ringExtended = getAngle3D(landmarks[13], landmarks[14], landmarks[16]) > 150;

  // For Pinky: MCP(17) -> PIP(18) -> Tip(20)
  const pinkyExtended = getAngle3D(landmarks[17], landmarks[18], landmarks[20]) > 150;

  // For a true "Open Palm", all 5 fingers must be extended
  return thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended;
}

export function applyGestureHeuristics(results: any): any {
  if (!results || !results.landmarks || !results.gestures) return results;

  for (let i = 0; i < results.landmarks.length; i++) {
    let gesture = results.gestures[i]?.[0]?.categoryName || 'None';

    // If the model predicts None, check if the hand is actually open via angle geometry
    if (gesture === 'None' || gesture === '') {
      if (isOpenPalm(results.landmarks[i])) {
        if (!results.gestures[i]) results.gestures[i] = [];
        if (!results.gestures[i][0]) results.gestures[i][0] = { categoryName: 'Open_Palm', score: 0.99 };
        else {
          results.gestures[i][0].categoryName = 'Open_Palm';
          results.gestures[i][0].score = 0.99; // Artificial high score for heuristic override
        }
      }
    }
  }

  return results;
}

function getHandBoundingBox(landmarks: any[]) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function extractHandTelemetry(results: any, isFrontCamera: boolean): DetectedHand[] {
  const detectedHandsList: DetectedHand[] = [];
  if (results?.handedness) {
    for (let i = 0; i < results.handedness.length; i++) {
      const handData = results.handedness[i][0];
      let handLabel = handData.categoryName;
      // Anatomically correct hand swap in front camera mode
      if (isFrontCamera) {
        handLabel = handLabel === 'Left' ? 'RIGHT' : 'LEFT';
      } else {
        handLabel = handLabel === 'Left' ? 'LEFT' : 'RIGHT';
      }
      const score = Math.round(handData.score * 100);

      let gName = 'N/A';
      let gScore = 0;
      if (results.gestures && results.gestures[i] && results.gestures[i][0]) {
        gName = results.gestures[i][0].categoryName;
        gScore = Math.round(results.gestures[i][0].score * 100);
      }

      let sizeRatio = 0;
      let isFullyInFrame = false;

      if (results.landmarks && results.landmarks[i]) {
        const landmarks = results.landmarks[i];
        const box = getHandBoundingBox(landmarks);
        sizeRatio = Math.round((box.width * box.height) * 100); // percentage
        const margin = 0.05;
        isFullyInFrame = box.minX > margin && box.maxX < (1 - margin) && 
                         box.minY > margin && box.maxY < (1 - margin);
      }

      detectedHandsList.push({
        handedness: handLabel,
        score,
        gesture: gName,
        gestureScore: gScore,
        sizeRatio,
        isFullyInFrame
      });
    }
  }
  return detectedHandsList;
}
