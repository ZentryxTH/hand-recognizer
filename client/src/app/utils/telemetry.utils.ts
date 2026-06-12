import { DetectedHand } from '../models/telemetry.interface';

// Calculate 3D Euclidean distance between two landmarks
function getDistance3D(p1: any, p2: any): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  // Fallback to 0 if z is not provided by the model
  const dz = (p2.z || 0) - (p1.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// A real-world, rotation-invariant check for an Open Palm.
// A finger is "extended" if its Tip is further from the Wrist than its PIP (middle knuckle) joint.
// If it is curled into a fist, the Tip will be closer to the Wrist than the knuckle.
function isOpenPalm(landmarks: any[]): boolean {
  if (!landmarks || landmarks.length < 21) return false;

  const wrist = landmarks[0];

  // Check if each finger is fully extended (Tip distance > PIP distance)
  // Thumb: Tip = 4, MCP = 2
  const thumbExtended = getDistance3D(wrist, landmarks[4]) > getDistance3D(wrist, landmarks[2]);

  // Index: Tip = 8, PIP = 6
  const indexExtended = getDistance3D(wrist, landmarks[8]) > getDistance3D(wrist, landmarks[6]);

  // Middle: Tip = 12, PIP = 10
  const middleExtended = getDistance3D(wrist, landmarks[12]) > getDistance3D(wrist, landmarks[10]);

  // Ring: Tip = 16, PIP = 14
  const ringExtended = getDistance3D(wrist, landmarks[16]) > getDistance3D(wrist, landmarks[14]);

  // Pinky: Tip = 20, PIP = 18
  const pinkyExtended = getDistance3D(wrist, landmarks[20]) > getDistance3D(wrist, landmarks[18]);

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
