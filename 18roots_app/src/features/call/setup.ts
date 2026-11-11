import { registerGlobals } from "@livekit/react-native";

// LiveKit needs WebRTC globals installed once, before any room is created.
let registered = false;
export function setupCalls() {
  if (registered) return;
  registerGlobals();
  registered = true;
}
