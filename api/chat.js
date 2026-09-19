import { handleNodeRequest } from "../server/openai-api.mjs";
export const config = { maxDuration: 60 };
export default function handler(request, response) {
  return handleNodeRequest("chat", request, response);
}
