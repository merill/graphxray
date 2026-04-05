import { tabs } from "./browserApi.js";

export const getActiveTab = async function () {
  try {
    return await tabs.query({ active: true, currentWindow: true });
  } catch (ex) {
    throw ex;
  }
};

export const getStartTab = async function () {
  try {
    return await tabs.query({ active: true });
  } catch (ex) {
    throw ex;
  }
};
