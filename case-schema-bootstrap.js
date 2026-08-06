let skillCatalog = { schemaVersion: 1, skills: [] };

boot = async function bootWithCaseSchemaV2() {
  const manifest = await fetchJson("./data/cases/index.json");
  if (manifest.skillsPath) skillCatalog = await fetchJson(manifest.skillsPath);
  const skillValidation = validateSkillCatalog(skillCatalog);
  if (!skillValidation.valid) throw new Error(`技能カタログを確認してください: ${skillValidation.errors.join(" / ")}`);

  catalog = await Promise.all(
    manifest.cases
      .filter((item) => item.status === "published")
      .map(async (item) => {
        const source = await fetchJson(item.path);
        const data = normalizeCaseDefinition(source, item);
        const validation = validateCaseDefinition(data, skillCatalog);
        if (!validation.valid) throw new Error(`${item.id}: ${validation.errors.join(" / ")}`);
        return { ...item, sourceSchemaVersion: source.schemaVersion, data };
      }),
  );

  window.addEventListener("hashchange", () => {
    currentView = parseHash();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  });

  document.addEventListener("click", (event) => handleClick(event));
  document.addEventListener("input", (event) => handleInput(event));
  document.addEventListener("change", (event) => handleInput(event));

  if (!location.hash) location.hash = "#home";
  render();
};
