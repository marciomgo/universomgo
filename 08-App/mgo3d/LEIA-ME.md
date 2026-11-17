# MGO 3D — teste de combate (5 parques de Porto Alegre)

Organizado pelas camadas do `Arquitetura-v2.md`. Cada pasta responde a UMA pergunta.

| Camada (SDD) | Pasta / arquivo | Pergunta que responde |
|---|---|---|
| 3 · Arena | `arena/` | ONDE o jogo pode acontecer (contorno, caminhos, zonas proibidas, largada, pontos, curas, pedras, bombas) |
| 1 · Conteúdo | `conteudo/combate-teste.json` | O QUE entra no combate de teste (5 bases, 3 zumbis + chefão por base, chefão final, curas, pedras normais, bombas, armas, link da pesquisa) |
| 4–7 · Motor + apresentação | `../prototipo-3d-maplibre/proto-modelo.html` | COMO o jogo roda (ainda monolítico: fases 2–5 do SDD ficam para depois) |
| Build | `build/gerar-teste-combate.js` | Junta arena + conteúdo + modelo e gera `saida/` (ninguém edita a saída à mão) |
| Conferência | `conferir/` | Mapa de satélite com o combate desenhado, para aprovar cada parque antes de publicar |

A arena não sabe nada de combate; o conteúdo não sabe nada de parque. Parque novo = só rodar a arena. Regra nova de combate = só mexer no JSON.

## Parques
`parcao`, `farroupilha`, `marinha-do-brasil`, `harmonia`, `germania` (lista em `conteudo/combate-teste.json`).
Dados do OpenStreetMap em `arena/parques/<slug>/` (`rel.json` contorno, `area.json` caminhos/prédios/água/ruas/parquinhos/quadras, `ent.json` banheiros/bebedouros/entradas).
Opcional por parque: `zonas.json` (zonas proibidas vistas no satélite: `{nome,lat,lng,r}`), `largada.json`, `opcoes.json`.
- Parcão: a saída é idêntica à v3 gravada no CMS em 2026-11-11 (conferido ponto a ponto).
- Harmonia: parque de gramado, quase sem trilhas; usa `opcoes.json` (`modoPontos: "area"`, `usarTodasAsPartes`): pontos e bombas em qualquer lugar da área segura.

## Comandos (na pasta `mgo3d`)
```
npm install                                      # uma vez
node arena/buscar-parque-api.js <slug> <relation|way> <id>   # baixa um parque novo do OpenStreetMap (a Overpass pública vive lotada; este é o plano B)
node arena/gerar-arena.js <slug>                 # gera arena/parques/<slug>/arena.json
node build/gerar-teste-combate.js                # gera saida/ + conferir/dados/
node conferir/srv.js                             # http://localhost:8771/  (satélite + combate + EDITOR; botões no topo trocam de parque)
node build/servir-saida.js                       # http://localhost:8772/combate.html  (testa as páginas; imagens vêm de docs/)
```

## Editor de ajustes (conferir/, http://localhost:8771/)
Satélite com o combate por cima. Ajustes manuais, por parque (botão "Salvar e gerar de novo" grava, regenera a arena e o build):
- 🔴 **Zona proibida**: desenhar círculo ou polígono (vai para `zonas.json`).
- 🟢 **Liberar área**: polígono que cancela uma proibição automática do mapa (`liberar.json`).
- 🔵 **Trilha nova**: linha desenhada (`caminhos-extra.json`).
- Clicar numa trilha ciano = tirar (cinza); clicar num círculo laranja (parquinho/quadra do mapa) = ignorar (ambos em `opcoes.json`).
- Arrastar o **L** = nova largada (`largada.json`).
- Contorno amarelo do parque: lápis ✏️ e puxar os pontos (`perimetro.json`; apagar o arquivo volta ao contorno do OpenStreetMap).
- Quadro embaixo à direita: fundo do mapa (satélite / mapa colorido com ruas e prédios / topográfico) e camadas ligáveis (prédios, água, ruas de carro e de serviço mapeados, área segura).
Cada salvamento guarda cópia do que existia em `arena/parques/<slug>/edicoes-anteriores/`. Salvar sorteia pontos e monstros de novo naquele parque.

### Inteligência de terreno (arena/regras-terreno.json)
O gerador lê os sinais do OpenStreetMap e decide o que bloquear. As regras são DADOS (editar o JSON e gerar de novo):
- **Água** (lagos, lagoas, alagadiço/pântano, represas) e **canais/valas/riachos**: bloqueados com folga.
- **Mata densa** (natural=wood/scrub, landuse=forest = o verde escuro com ícones de árvore): se passa trilha dentro, vale só um corredor de 8 m em volta da trilha; se não passa trilha nenhuma, a mata inteira fica proibida.
- **Sinais que liberam a mata**: churrasqueira, mesa de piquenique, abrigo (25/20 m), banco (10 m).
- **Áreas restritas**: acesso privado, estacionamento, instalações técnicas, comércio, obra, aterro, centros esportivos. **Cercas e muros** viram linhas bloqueadas; cerca que fecha área pequena bloqueia o miolo.
- O editor mostra tudo isso em camadas (quadro embaixo à direita). Baixar de novo os dados de um parque: `node arena/buscar-parque-api.js <slug> <relation|way> <id> --forcar`.
- Experimento (arena/experimento-satelite.js): o brilho da foto de satélite separa mata de gramado com acerto balanceado de 69 a 83% (textura é fraca, 57 a 70%). Serve como sugestão para conferência humana, não como regra automática.

### Tudo que o código gera é editável
- **Área verde** (onde o jogo coloca bases, monstros e itens): lápis ✏️ para puxar os cantos, lixeira para apagar um pedaço, "Área verde nova" para desenhar outra (`segura-editada.json`; o contorno do jogo cresce para conter o verde; as zonas proibidas desenhadas continuam cortando). "↩ verde automático" apaga a edição.
- **Itens do combate** (bases, zumbis, chefões, curas, pedras, bombas): mover, apagar e adicionar no mapa (`combate-editado.json`, vale no lugar do combate montado pelo código e sobrevive a novas gerações da arena). "↩ combate automático" apaga a edição.

## O que mudou no modelo do jogo (`proto-modelo.html`), tudo ligado só por chaves do DADOS
- `semEspecial`: só estilingue com pedra normal + galho (sem pedra amarela).
- `celebraAoLimpar`: nas missões de parque, "Missão cumprida!" quando todos os monstros morrem; "Jogar de novo" recarrega a missão.
- `pesquisaUrl`: botão 📝 no menu e "Responder a pesquisa rápida" na tela de fim (abre em outra aba).
- `slug`: cada parque guarda o seu "já baixei pra jogar offline" (antes todos dividiam o mesmo registro).
- O tempo da partida passa a contar a partir do toque em "Ativar GPS e bússola".
Páginas que não usam essas chaves (mapa3d, dupla, escalada, livre) não mudam. Dupla e escalada são geradas por `editar-*.js` a partir do modelo: **não foram regeneradas**.

## Falta
- Link do Forms: trocar `pesquisaUrl` em `conteudo/combate-teste.json` e rodar o build.
- Aprovação de cada parque no satélite (zonas proibidas: parquinhos, áreas cercadas, preservação).
- Teste em campo; publicar (copiar `saida/*.html` + manifests para `docs/` do `sitemeuguiaoutdoor`) só com o "pode" do Márcio.
