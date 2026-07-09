---
"@openpkg-ts/sdk": minor
---

Remove toReact/toReactString and the ReactLayoutOptions type. The generated scaffolds pointed at the retired component registry workflow ("openpkg docs add") and never-shipped components. For framework docs generation use toMarkdown/toHTML with toNavigation/toFumadocsMetaJSON/toDocusaurusSidebarJS, or the generate-docs agent skill shipped with @openpkg-ts/cli.
