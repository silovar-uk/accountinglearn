let basicsCourse = null;

const legacyBootForBasics = boot;
boot = async function bootWithFoundations() {
  basicsCourse = await fetchJson("./data/basics/index.json");
  return legacyBootForBasics();
};
