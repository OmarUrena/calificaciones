// Run the frontend on http://127.0.0.1:3001, then: node scripts/check-technical-outcomes.mjs
// Uses the browser dependency already installed by the backend. All API responses are mocked.
import assert from "node:assert/strict";
import { chromium } from "../../back/node_modules/playwright/index.mjs";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const base = process.env.RA_TEST_URL || "http://127.0.0.1:3001";
    await context.addCookies([
      { name: "califapp_token", value: "test-only", url: base },
    ]);
    await context.addInitScript(() =>
      localStorage.setItem("califapp_token", "test-only"),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let outcomes = [];
    const writes = [];
    let failNextSave = false;
    let role = "ADMIN";
    const subject = {
      id: "test-subject",
      schoolId: "test-school",
      name: "Instalaciones eléctricas",
      type: "TECHNICAL",
      isActive: true,
    };
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api(?=\/)/, "");
      if (path === "/auth/me") {
        return route.fulfill({
          json: {
            id: "test-admin",
            role,
            fullName: "Prueba local",
            schoolId: subject.schoolId,
            school: { id: subject.schoolId, name: "Escuela de prueba" },
          },
        });
      }
      if (path === "/subjects" && request.resourceType() === "fetch")
        return route.fulfill({ json: [subject] });
      if (path.startsWith("/technical-learning-outcomes")) {
        if (request.method() === "GET")
          return route.fulfill({ json: outcomes });
        const body = request.postDataJSON();
        writes.push({ path, method: request.method(), body });
        if (failNextSave) {
          failNextSave = false;
          return route.fulfill({
            status: 500,
            json: { message: "No se pudo guardar la configuración de prueba." },
          });
        }
        if (path.endsWith("/batch")) {
          outcomes = body.items.map((item, index) => ({
            ...item,
            id: `saved-${index + 1}`,
          }));
          return route.fulfill({ json: outcomes });
        }
        if (path.endsWith("/weights")) {
          outcomes = outcomes.map((outcome) => ({
            ...outcome,
            ...(body.items.find((item) => item.id === outcome.id) || {}),
          }));
          return route.fulfill({ json: outcomes });
        }
        if (request.method() === "POST") {
          const created = { ...body, id: `saved-${outcomes.length + 1}` };
          outcomes.push(created);
          return route.fulfill({ json: created });
        }
        const id = path.split("/").at(-1);
        outcomes = outcomes.map((outcome) =>
          outcome.id === id ? { ...outcome, ...body } : outcome,
        );
        return route.fulfill({
          json: outcomes.find((outcome) => outcome.id === id),
        });
      }
      // Block any unexpected remote requests during this isolated check.
      if (url.origin !== base) return route.abort();
      return route.continue();
    });

    await page.goto(`${base}/subjects/${subject.id}/technical-outcomes`);
    const count = page.getByLabel("Cantidad de RA del módulo");
    const save = page.getByRole("button", {
      name: "Guardar cambios",
      exact: true,
    });
    await count.waitFor();
    await count.fill("5");
    assert.equal(await page.locator("tbody tr").count(), 5);
    assert.equal(writes.length, 0, "Changing count must not write to the API");
    for (let index = 1; index <= 5; index += 1) {
      const row = page.locator("tbody tr").nth(index - 1);
      assert.equal(await row.locator("td").nth(0).innerText(), String(index));
      assert.equal(await row.locator("td").nth(1).innerText(), `RA${index}`);
      assert.equal(await row.locator("td").nth(2).innerText(), `RA${index}`);
      assert.equal(
        await page
          .getByLabel(`Peso de RA${index}`, { exact: true })
          .inputValue(),
        "0",
      );
    }
    // Native keyboard increment/decrement creates and removes only local rows.
    await count.press("ArrowUp");
    assert.equal(await page.locator("tbody tr").count(), 6);
    await count.press("ArrowDown");
    assert.equal(await page.locator("tbody tr").count(), 5);
    const firstWeight = page.getByLabel("Peso de RA1", { exact: true });
    await firstWeight.fill("");
    await firstWeight.pressSequentially("20");
    assert.equal(
      await firstWeight.inputValue(),
      "20",
      "Typing must preserve input focus across renders",
    );
    for (let index = 2; index <= 5; index += 1)
      await page.getByLabel(`Peso de RA${index}`, { exact: true }).fill("20");
    await count.fill("3");
    assert.equal(await page.locator("tbody tr").count(), 3);
    assert.equal(
      await firstWeight.inputValue(),
      "20",
      "Retained rows keep their edited weights",
    );
    await count.fill("5");
    assert.equal(
      await page.getByLabel("Peso de RA5", { exact: true }).inputValue(),
      "0",
    );
    for (let index = 4; index <= 5; index += 1)
      await page.getByLabel(`Peso de RA${index}`, { exact: true }).fill("20");
    assert.equal(
      writes.length,
      0,
      "Editing weights must not write before Save",
    );

    failNextSave = true;
    await save.click();
    await page
      .getByRole("alert")
      .filter({ hasText: "No se pudo guardar" })
      .waitFor();
    assert.equal(
      await page.locator("tbody tr").count(),
      5,
      "A failed save retains drafts",
    );
    assert.equal(outcomes.length, 0);
    await save.click();
    await page.waitForFunction(
      () => document.querySelector("#outcome-count").readOnly,
    );
    assert.equal(writes.length, 2);
    assert.equal(writes[1].path, "/technical-learning-outcomes/batch");
    assert.equal(outcomes.length, 5);
    assert.equal(
      outcomes.reduce((sum, outcome) => sum + outcome.weight, 0),
      100,
    );
    assert.equal(await count.getAttribute("readonly"), "");
    assert.equal(await save.isDisabled(), true);

    // Validate the final allocation together instead of rejecting a temporary total of 110.
    await firstWeight.fill("30");
    await save.click();
    await page
      .getByRole("alert")
      .filter({ hasText: "no puede superar 100" })
      .waitFor();
    assert.equal(
      writes.length,
      2,
      "Invalid final totals are rejected before a request",
    );
    await page.getByLabel("Peso de RA2", { exact: true }).fill("10");
    await save.click();
    await page.waitForFunction(
      () => !document.body.innerText.includes("Cambios sin guardar"),
    );
    assert.equal(
      writes.at(-1).path,
      `/technical-learning-outcomes/subject/${subject.id}/weights`,
    );
    assert.deepEqual(
      outcomes.slice(0, 2).map((outcome) => outcome.weight),
      [30, 10],
    );

    await firstWeight.fill("99");
    await page
      .getByRole("button", { name: "Descartar cambios", exact: true })
      .click();
    assert.equal(await firstWeight.inputValue(), "30");
    assert.equal(writes.length, 3);
    await page.reload();
    await count.waitFor();
    assert.equal(await count.inputValue(), "5");
    assert.equal(await count.getAttribute("readonly"), "");
    assert.equal(await firstWeight.inputValue(), "30");

    // The original individual create form remains usable after saving the initial batch.
    await page.getByRole("button", { name: "Crear RA", exact: true }).click();
    await page.getByLabel("Codigo", { exact: false }).fill("RA6");
    await page.getByLabel("Orden", { exact: false }).fill("6");
    await page
      .getByLabel("Nombre", { exact: false })
      .fill("Resultado adicional");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector("#outcome-count").value === "6",
    );
    assert.equal(writes.at(-1).path, "/technical-learning-outcomes");
    assert.equal(await page.locator("tbody tr").count(), 6);

    // Non-admin readers retain the existing table and cannot edit its configuration.
    role = "TEACHER";
    await page.reload();
    await page
      .getByText("Solo usuarios administrativos pueden gestionar RA tecnicos.")
      .waitFor();
    assert.equal(await page.locator("#outcome-count").count(), 0);
    assert.equal(await page.locator("tbody input").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "Passed: local count and arrows, RA defaults, editable weights, explicit save, failure recovery, total validation, locked saved count, discard, reload, individual creation, and teacher permissions.",
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
