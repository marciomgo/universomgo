# Protótipo 3D (MapLibre) — fonte

- `proto-modelo.html`: modelo base (a página inteira com um marcador `/*DADOS*/`).
- `gerar-proto.js`: gera `saida/mapa3d.html` (Parcão), `mapa3d-casa.html`, `mapa3d-livre.html`.
- `editar-dupla.js` + `gerar-dupla.js` (nessa ordem): fazem uma CÓPIA do modelo com a missão em dupla (e os ataques visíveis pro parceiro) e geram `saida/mapa3d-dupla.html`.
- `dados/`: pontos do Parcão (data-v2.json) e da casa (casa3.json).
- Publicação: copiar de `saida/` para `docs/` do repo `sitemeuguiaoutdoor` (GitHub Pages). As imagens (mineu-*.png, icone-pau.png) ficam em `docs/`; originais no Wix.
- Rodar: `node gerar-proto.js` e `node editar-dupla.js && node gerar-dupla.js`.

## Jogar sem internet (offline)
- `offline-no-modelo.js` (rodado uma vez): botão "Baixar o parque" + registro do service worker no modelo base; manifests por página; geradores escrevem `saida/manifest-*.json`.
- `sw-mgo.js` + `estaticos/` (ícones): vão pra `docs/` junto com as páginas. `teste-sw.js` testa o roteamento do service worker sem navegador (`node teste-sw.js`).
- Teste real: celular com internet → abrir a página → "Baixar o parque" → modo avião → reabrir (de preferência instalado na tela inicial).
