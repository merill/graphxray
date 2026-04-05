import { storage } from "./browserApi.js";

const saveObjectInLocalStorage = async function (obj) {
  try {
    await storage.local.set(obj);
  } catch (ex) {
    throw ex;
  }
};

const getObjectFromLocalStorage = async function (key) {
  try {
    const value = await storage.local.get(key);
    return value[key];
  } catch (ex) {
    throw ex;
  }
};

const commitIfActive = async function (obj) {
  const isActive = await getIsActive();
  if (isActive) {
    await saveObjectInLocalStorage(obj);
  }
};

const getIsActive = async () => {
  return true;
};
const getStack = async () => await getObjectFromLocalStorage("stack");
const getCurrentMetrics = async () =>
  await getObjectFromLocalStorage("currentMetrics");
const getContextSwitches = async () =>
  await getObjectFromLocalStorage("contextSwitches");

const addChoices = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { choices } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      choices: choices + i,
    },
  });
};
const addConcepts = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { concepts } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      concepts: concepts + i,
    },
  });
};

const addClicks = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { clicks } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      clicks: clicks + i,
    },
  });
  console.log("getting clicks");
};

const addKeystrokes = async (i = 1) => {
  const currentMetrics = await getObjectFromLocalStorage("currentMetrics");
  let { keystrokes } = currentMetrics;
  await commitIfActive({
    currentMetrics: {
      ...currentMetrics,
      keystrokes: keystrokes + i,
    },
  });
};

export {
  getObjectFromLocalStorage,
  saveObjectInLocalStorage,
  commitIfActive,
  getIsActive,
  getStack,
  getCurrentMetrics,
  getContextSwitches,
  addClicks,
  addConcepts,
  addChoices,
  addKeystrokes,
};
