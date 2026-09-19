import { handleNodeRequest } from "../server/openai-api.mjs";
export const config = { maxDuration: 240 };
export default function handler(request, response) {
  return handleNodeRequest("simulate", request, response);
}
