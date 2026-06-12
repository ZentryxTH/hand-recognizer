import { DetectedHand } from '../models/telemetry.interface';

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

      detectedHandsList.push({
        handedness: handLabel,
        score,
        gesture: gName,
        gestureScore: gScore
      });
    }
  }
  return detectedHandsList;
}
