import { handleNodeRequest } from "../server/openai-api.mjs";
export const config = { maxDuration: 30 };
export default function handler(request, response) {
  return handleNodeRequest("voice-session", request, response);
}
