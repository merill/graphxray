import { runtime } from "../common/browserApi.js";

runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Request", request);
  sendResponse("response");
});
