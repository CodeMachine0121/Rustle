import { allowsAttribute, allowsElement } from "./PreviewHtmlPolicy";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/**
 * The second net: parses the HTML again, the way the panel will, and removes
 * whatever the policy does not allow. A sanitizer's output that re-parses
 * into something else (mutation XSS) is caught here.
 */
export function recheckPreviewHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    if (element.namespaceURI !== HTML_NAMESPACE || !allowsElement(element.localName)) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!allowsAttribute(attribute.name, attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return template.innerHTML;
}
