// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { SOURCE_LINE_ATTRIBUTE } from "./PreviewHtmlPolicy";
import { renderPreviewHtml } from "./renderPreviewHtml";

function preview(body: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderPreviewHtml(body);
  return container;
}

function only(container: HTMLElement, selector: string): Element {
  const elements = container.querySelectorAll(selector);
  expect(elements).toHaveLength(1);
  return elements[0] as Element;
}

describe("rendering a body", () => {
  it("renders a heading and a paragraph", () => {
    const shown = preview("## 取捨\n\n攤開來看：");

    expect(only(shown, "h2").textContent).toBe("取捨");
    expect(only(shown, "p").textContent).toBe("攤開來看：");
  });

  it("renders the CommonMark inline syntax", () => {
    const shown = preview("**粗** *斜* `碼` [連結](notes/other.md)");

    expect(only(shown, "strong").textContent).toBe("粗");
    expect(only(shown, "em").textContent).toBe("斜");
    expect(only(shown, "code").textContent).toBe("碼");
    expect(only(shown, "a").getAttribute("href")).toBe("notes/other.md");
  });

  it("renders the CommonMark block syntax", () => {
    const shown = preview("- 一\n- 二\n\n1. 甲\n2. 乙\n\n> 引用\n\n***\n");

    expect(shown.querySelector("ul")).not.toBeNull();
    expect(shown.querySelector("ol")).not.toBeNull();
    expect(shown.querySelector("blockquote")).not.toBeNull();
    expect(shown.querySelector("hr")).not.toBeNull();
  });

  it("renders strikethrough", () => {
    expect(only(preview("~~不做~~"), "s").textContent).toBe("不做");
  });

  it("renders a table with a head and a body", () => {
    const shown = preview("| 欄 | 值 |\n| --- | --- |\n| a | 1 |\n| b | 2 |");

    expect(only(shown, "table thead").querySelectorAll("th")).toHaveLength(2);
    expect(only(shown, "table tbody").querySelectorAll("tr")).toHaveLength(2);
  });

  it("renders task list items as checkbox marks that are not form controls", () => {
    const shown = preview("- [ ] 還沒做\n- [x] 做完了");

    const marks = Array.from(shown.querySelectorAll("li [role='checkbox']"));
    expect(marks.map((mark) => mark.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(marks.every((mark) => mark.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(shown.querySelector("input, button, select, textarea, form")).toBeNull();
    expect(Array.from(shown.querySelectorAll("li")).map((item) => item.textContent)).toEqual([
      "還沒做",
      "做完了",
    ]);
  });

  it("highlights fenced code that names a known language", () => {
    const code = only(preview("```ts\nconst answer = 1\n```"), "pre > code");

    expect(code.classList).toContain("language-ts");
    expect(code.querySelectorAll("span[class^='hljs-']").length).toBeGreaterThan(0);
    expect(code.textContent).toBe("const answer = 1\n");
  });

  it("shows fenced code without a language as plain escaped text", () => {
    const code = only(preview("```\n<b>不是粗體</b>\n```"), "pre > code");

    expect(code.textContent).toBe("<b>不是粗體</b>\n");
    expect(code.querySelector("b")).toBeNull();
    expect(code.querySelector("span")).toBeNull();
  });

  it("shows fenced code in an unknown language as it is", () => {
    const code = only(preview("```klingon\nQapla'\n```"), "pre > code");

    expect(code.textContent).toBe("Qapla'\n");
    expect(code.querySelector("span")).toBeNull();
  });

  it("treats a leading --- as a horizontal rule, not as front matter", () => {
    const shown = preview("---\n字");

    expect(shown.querySelector("hr")).not.toBeNull();
    expect(only(shown, "p").textContent).toBe("字");
  });

  it("renders an empty body as nothing", () => {
    expect(preview("").innerHTML).toBe("");
  });
});

describe("sanitizing what the body contains", () => {
  it("drops a script together with its text", () => {
    const shown = preview("<script>window.pwned = true</script>");

    expect(shown.querySelector("script")).toBeNull();
    expect(shown.textContent).not.toContain("window.pwned = true");
  });

  it.each([
    '<img src="images/a.png" onerror="window.pwned = true">',
    '<div onclick="window.pwned = true">點我</div>',
    '<p onmouseover="window.pwned = true">滑過</p>',
    '<a href="https://example.com" onfocus="window.pwned = true">連結</a>',
  ])("removes every event attribute from %s", (html) => {
    const attributes = Array.from(preview(html).querySelectorAll("*")).flatMap((element) =>
      element.getAttributeNames(),
    );

    expect(attributes.filter((name) => name.startsWith("on"))).toEqual([]);
  });

  it.each([
    "javascript:window.pwned = true",
    "JaVaScRiPt:alert(1)",
    "java&#9;script:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//evil.example/x",
  ])("keeps the text but not the href of a link to %s", (address) => {
    const link = only(preview(`<a href="${address}">連結</a>`), "a");

    expect(link.textContent).toBe("連結");
    expect(link.hasAttribute("href")).toBe(false);
  });

  it("does not turn a markdown javascript link into a link", () => {
    const shown = preview("[點我](javascript:window.pwned = true)");

    expect(shown.textContent).toContain("點我");
    expect(shown.querySelector("[href]")).toBeNull();
  });

  it.each([
    ['<iframe src="https://evil.example"></iframe>', "iframe"],
    ['<object data="https://evil.example/x.swf"></object>', "object"],
    ['<embed src="https://evil.example/x">', "embed"],
    ['<base href="https://evil.example/">', "base"],
    ['<meta http-equiv="refresh" content="0;url=https://evil.example">', "meta"],
    ['<link rel="stylesheet" href="https://evil.example/x.css">', "link"],
    ["<style>body{display:none}</style>", "style"],
    ["<svg><script>window.pwned = true</script></svg>", "svg"],
    ["<math><mtext></mtext></math>", "math"],
  ])("drops %s entirely", (html, tagName) => {
    const shown = preview(html);

    expect(shown.getElementsByTagName(tagName)).toHaveLength(0);
    expect(shown.textContent).not.toContain("window.pwned");
  });

  it("keeps a paragraph but not its style attribute", () => {
    const paragraph = only(
      preview('<p style="background:url(https://evil.example/x.png)">字</p>'),
      "p",
    );

    expect(paragraph.textContent).toBe("字");
    expect(paragraph.hasAttribute("style")).toBe(false);
  });

  it.each([
    ["images/8f3c.png", "images/8f3c.png"],
    ["rustle://vault/Blog/images/8f3c.png", "rustle://vault/Blog/images/8f3c.png"],
    ["https://evil.example/pixel.png", null],
    ["http://evil.example/pixel.png", null],
    ["data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pjwvc2NyaXB0Pjwvc3ZnPg==", null],
    ["file:///etc/passwd", null],
    ["//evil.example/pixel.png", null],
  ])("gives an image from %s the source %s", (source, expected) => {
    const image = only(preview(`<img src="${source}" alt="圖">`), "img");

    expect(image.getAttribute("src")).toBe(expected);
  });

  it("keeps a markdown image's relative source when no workspace is known", () => {
    expect(only(preview("![](images/8f3c.png)"), "img").getAttribute("src")).toBe(
      "images/8f3c.png",
    );
  });

  it("keeps an external link because following it loads nothing into the preview", () => {
    expect(only(preview("[說明](https://example.com/doc)"), "a").getAttribute("href")).toBe(
      "https://example.com/doc",
    );
  });

  it("leaves nothing to type into or submit", () => {
    const shown = preview(
      '<form action="https://evil.example"><input type="text"><textarea></textarea><button>送出</button><select><option>一</option></select></form>',
    );

    expect(shown.querySelector("form, input, textarea, button, select, [contenteditable]")).toBeNull();
  });

  it("disarms a body full of every trick at once", () => {
    const hostileBody = [
      "# 看起來很正常",
      "<script>window.pwned = true</script>",
      '<img src="x" onerror="window.pwned = true">',
      '<img src="https://evil.example/pixel.png">',
      '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
      '<a href="JaVaScRiPt:alert(1)">一</a> <a href="data:text/html,x">二</a> <a href="vbscript:msgbox(1)">三</a>',
      '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x">',
      '<base href="https://evil.example/"><meta http-equiv="refresh" content="0">',
      '<link rel="stylesheet" href="https://evil.example/x.css"><style>*{}</style>',
      "<svg><script>window.pwned = true</script></svg>",
      '<form><input value="x"></form>',
      '<div onclick="window.pwned = true" style="background:url(https://evil.example)">點</div>',
      "[點我](javascript:window.pwned = true)",
    ].join("\n\n");

    const shown = preview(hostileBody);

    expect(
      shown.querySelector("script, iframe, object, embed, base, meta, link, style, svg, form, input"),
    ).toBeNull();
    const attributes = Array.from(shown.querySelectorAll("*")).flatMap((element) =>
      Array.from(element.attributes),
    );
    expect(attributes.filter(({ name }) => name.startsWith("on"))).toEqual([]);
    expect(
      attributes.filter(({ value }) => /^\s*(javascript|data|vbscript):/i.test(value)),
    ).toEqual([]);
    expect(Array.from(shown.querySelectorAll("[src]")).map((element) => element.getAttribute("src"))).not.toContainEqual(
      expect.stringMatching(/^https?:/),
    );
    expect(only(shown, "h1").textContent).toBe("看起來很正常");
  });
});

describe("images kept in the workspace's images folder", () => {
  function imageSource(body: string, workspace: string | null): string | null {
    const container = document.createElement("div");
    container.innerHTML = renderPreviewHtml(body, workspace);
    return only(container, "img").getAttribute("src");
  }

  it("shows an image from the images folder through the vault scheme", () => {
    expect(imageSource("![](images/8f3c.png)", "Blog")).toBe(
      "rustle://vault/Blog/images/8f3c.png",
    );
  });

  it.each([
    ["A B", "images/x.png", "rustle://vault/A%20B/images/x.png"],
    ["隨筆", "images/x.png", "rustle://vault/%E9%9A%A8%E7%AD%86/images/x.png"],
    ["Blog", "images/我.png", "rustle://vault/Blog/images/%E6%88%91.png"],
    ["a/b?#", "images/x.png", "rustle://vault/a%2Fb%3F%23/images/x.png"],
  ])("encodes workspace %s and path %s as %s", (workspace, path, expected) => {
    expect(imageSource(`![](${path})`, workspace)).toBe(expected);
  });

  it.each([
    ["other/x.png"],
    ["images/nested/x.png"],
    ["images/.."],
    ["./images/x.png"],
    ["images/"],
  ])("keeps %s as written", (path) => {
    expect(imageSource(`![](${path})`, "Blog")).toBe(path);
  });

  it("keeps the alt text and title", () => {
    const container = document.createElement("div");
    container.innerHTML = renderPreviewHtml('![封面](images/x.png "標題")', "Blog");
    const image = only(container, "img");

    expect(image.getAttribute("alt")).toBe("封面");
    expect(image.getAttribute("title")).toBe("標題");
  });

  it("still drops a remote image", () => {
    const container = document.createElement("div");
    container.innerHTML = renderPreviewHtml("![](https://example.com/x.png)", "Blog");

    expect(container.querySelector("img")?.getAttribute("src") ?? null).toBeNull();
  });

  it("leaves an image written as HTML alone", () => {
    expect(imageSource('<img src="images/x.png">', "Blog")).toBe("images/x.png");
  });
});

describe("source lines for scroll sync", () => {
  function sourceLine(element: Element): string | null {
    return element.getAttribute(SOURCE_LINE_ATTRIBUTE);
  }

  it("marks each block with its zero-based line in the body", () => {
    const shown = preview("# 標題\n\n段落");

    expect(sourceLine(only(shown, "h1"))).toBe("0");
    expect(sourceLine(only(shown, "p"))).toBe("2");
  });

  it("marks fenced code with the line of its opening fence", () => {
    expect(sourceLine(only(preview("前言\n```\ncode\n```"), "pre"))).toBe("1");
  });

  it("marks each list item with its own line", () => {
    const items = Array.from(preview("- 一\n- 二\n- 三").querySelectorAll("li"));

    expect(items.map(sourceLine)).toEqual(["0", "1", "2"]);
  });

  it("keeps the source lines through both sanitizing layers", () => {
    const shown = preview("# 標題\n\n段落\n\n```ts\nconst a = 1\n```");

    expect(["h1", "p", "pre"].map((selector) => sourceLine(only(shown, selector)))).toEqual([
      "0",
      "2",
      "4",
    ]);
  });
});
