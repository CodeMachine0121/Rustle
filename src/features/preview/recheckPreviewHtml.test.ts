// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { recheckPreviewHtml } from "./recheckPreviewHtml";

describe("the second sanitizing net on its own", () => {
  it("removes scripts, event attributes and javascript links it is handed directly", () => {
    const container = document.createElement("div");
    container.innerHTML = recheckPreviewHtml(
      '<p onclick="window.pwned = true">字<script>window.pwned = true</script></p>' +
        '<a href="javascript:window.pwned = true">連結</a><img src="https://evil.example/x.png" onerror="x">',
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("p")?.hasAttribute("onclick")).toBe(false);
    expect(container.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(container.querySelector("img")?.getAttributeNames()).toEqual([]);
    expect(container.textContent).toBe("字連結");
  });

  it.each(["java&#9;script:alert(1)", " javascript:alert(1)", "JAVASCRIPT:alert(1)", "\\\\evil.example/x"])(
    "sees through %s",
    (address) => {
      const container = document.createElement("div");
      container.innerHTML = recheckPreviewHtml(`<a href="${address}">連結</a>`);

      expect(container.querySelector("a")?.hasAttribute("href")).toBe(false);
    },
  );

  it("removes elements from foreign namespaces even when their name is allowed", () => {
    const container = document.createElement("div");
    container.innerHTML = recheckPreviewHtml("<svg><a href='https://example.com'>x</a></svg>");

    expect(container.innerHTML).toBe("");
  });

  it("keeps what the policy allows untouched", () => {
    const html = '<p data-source-line="0" class="note"><a href="https://example.com">x</a></p>';

    expect(recheckPreviewHtml(html)).toBe(html);
  });
});
