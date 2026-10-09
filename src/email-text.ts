// Text extraction only: no DOM, scripting, links, images or remote resource fetching.
export function htmlText(html: string) {
  if (html.length > 2_000_000) throw Error("EMAIL_TOO_LARGE");
  const clean = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(
      /<(script|style|iframe|object|svg|head)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
      "",
    );
  let depth = 0,
    out = "";
  for (const token of clean.match(/<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith("<")) {
      if (/^<blockquote\b/i.test(token)) {
        depth++;
        out += "\n";
      } else if (/^<\/blockquote/i.test(token)) {
        depth = Math.max(0, depth - 1);
        out += "\n";
      } else if (/^<\/?(?:p|div|br|li|tr|h[1-6])\b/i.test(token)) out += "\n";
    } else out += (depth ? "\n> " : "") + token;
  }
  return out
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => {
      if (name[0] === "#") {
        const n =
          name[1].toLowerCase() === "x"
            ? parseInt(name.slice(2), 16)
            : Number(name.slice(1));
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
          ? String.fromCodePoint(n)
          : " ";
      }
      return (
        { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as any
      )[name.toLowerCase()];
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function emailBody(payload: any) {
  const plain: string[] = [],
    html: string[] = [];
  function read(p: any) {
    if (
      p.filename ||
      (p.headers || []).some(
        (h: any) =>
          h.name?.toLowerCase() === "content-disposition" &&
          /^attachment/i.test(h.value),
      )
    )
      return;
    if (p.body?.data && ["text/plain", "text/html"].includes(p.mimeType)) {
      const body = Buffer.from(p.body.data, "base64url").toString("utf8");
      (p.mimeType === "text/plain" ? plain : html).push(body);
    }
    for (const child of p.parts || []) read(child);
  }
  read(payload);
  return plain.length ? plain.join("\n") : html.map(htmlText).join("\n");
}
