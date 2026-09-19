import { handleNodeRequest } from "../server/openai-api.mjs";
export default function handler(request, response) {
  return handleNodeRequest("status", request, response);
}
