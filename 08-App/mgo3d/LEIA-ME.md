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
node build/servir-saida.js                       # http://localhost:8772/jogo.html  (testa as páginas; imagens vêm de docs/)
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

### Largada livre (sem ponto de partida fixo)
O jogo não tem mais largada fixa. A página leva a **arena** (piscina de pontos, curas, pedras, bombas e a área segura) e, no 1º sinal de GPS **dentro do contorno do parque**, monta o combate em volta de onde a pessoa está (função `build/combate-dinamico.js`, a mesma regra do build): 1ª base a ~80 m, mais 4 em sequência, 3 zumbis e um chefão por base, chefão final, e itens perto do percurso. Fora do parque o jogo avisa para ir até a área de jogo. Sem GPS (permissão negada) ou com `?teste=1` na página, monta no ponto padrão (L) — para testar de casa.
- Interruptor: `conteudo/combate-teste.json` → `largadaLivre` (true/false). Combate arrumado à mão no editor (`combate-editado.json`) = percurso fixo naquele parque.
- Teste: `node build/testar-largada-livre.js` sorteia 300 pontos de partida por parque (nos 5: 100% montaram, sempre com 5 bases, monstros dentro do verde).

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

### Regras que valem para QUALQUER parque (tudo em `arena/regras-terreno.json`, nada específico de um parque)
- **Satélite + OpenStreetMap se somam**: basta a coisa aparecer em um dos dois. O satélite (`arena/detectar-satelite.js`) acha quadras de areia/azuis e telhados; o que só ele vê vira zona proibida.
- **Trilhas** (`trilhas`): footway, path, pedestrian, cycleway e **steps** (escadinha). Só nelas entram pontos e itens.
- **Sem pontos** (`semPontos`): cachorródromo (forma real + 2 m) e `highway=track` (linha + 3 m). Monstros podem, largada/bases/curas/pedras/bombas não.
- **Lados** (`lados`): rua de carro que corta o parque cria perímetros independentes (mesmo com ponte). Só UM vale; o código avisa (AVISOS do build e faixa vermelha no editor) e o Márcio escolhe clicando no lado (`opcoes.json` → `ladoOficial`).
- **Frestas** (`verde`): o verde não tem pedaço solto menor que 300 m² nem passagem mais estreita que 6 m.
- **Lagos grandes** são multipolígonos no OpenStreetMap: o download (`buscar-parque-api.js`) já os junta. Atualizar só isso num parque existente: `node arena/buscar-parque-api.js <slug> --so-relacoes`.
- **Só o que está dentro do perímetro oficial** aparece no editor (prédios, água, cercas, trilhas são cortados no perímetro).
- **Editor**: tocar na BORDA de qualquer área = Apagar ou Editar (aparecem os pontos para puxar/criar/tirar, depois ✔ Pronto). Tudo é editável, menos apagar o contorno. Apagar grava em `opcoes.json` → `apagarNoPonto`; zonas próprias em `zonas.json` (polígono, círculo, linha com largura, ou com `semPontos:true`).
- **Parque novo, passo a passo**: 1) `node arena/buscar-parque-api.js <slug> <relation|way> <id>`; 2) `node arena/gerar-arena.js <slug>`; 3) `node arena/detectar-satelite.js <slug>` (precisa do passo 2 feito) e de novo `node arena/gerar-arena.js <slug>` para as zonas do satélite entrarem; 4) acrescentar o parque em `conteudo/combate-teste.json`; 5) `node build/gerar-teste-combate.js`.
- Atenção: um verde editado à mão (`segura-editada.json`) fica congelado e **não recebe regras novas**. O gerador avisa quando ele é quase igual ao automático; "voltar verde automático" no editor descongela.

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
