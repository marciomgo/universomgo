# Blocos do jogo

O jogo é **um só**: `proto-modelo.html` (o modelo). Tudo o que é opcional vira um **bloco** que se liga ou desliga por **modo**, sem mexer no código do jogo.

## Como funciona

1. `blocos.json` é o **catálogo**: lista os blocos (o que cada um é, arquivos e modelos 3D que usa) e os **modos** (quais blocos cada tipo de página liga).
2. O modelo declara um **encaixe** (`<!--BLOCOS-->`, antes de `</body>`).
3. `../montar-blocos.js` é o **único lugar** que preenche o encaixe e copia os arquivos. Os dois builds o chamam:
   - `../gerar-proto.js` (treino livre e páginas antigas)
   - `../../mgo3d/build/gerar-teste-combate.js` (combate nos parques)

## Blocos de hoje

| Bloco | O que faz | Arquivo |
|---|---|---|
| `monstros3d` | Monstros 3D (zumbi Orc com bastão, chefão BlueDemon sem fogo, final Dragon_Evolved com fogo laranja); anda, ataca, leva dano, morre | `monstros-3d.js` |
| `pedraDireita` | Botões da pedra à direita do estilingue | `layout-pedra-direita.css` |
| `joystick` | Joystick na tela (anda/gira sem GPS), embaixo à esquerda | `joystick.js` |
| `pacoteObrigatorio` | Antes de jogar, o parque precisa estar baixado (mapa + jogo + 3D; ~8 MB). Conferido toda vez que a página abre; saída: "Jogar assim mesmo" | `pacote-obrigatorio.js` |
| `telemetria` | Mede sem perguntar: quadros por segundo, travadas, erros, aparelho, GPS, se o parque estava baixado (anônimo) | `telemetria.js` |
| `pesquisa` | Pesquisa rápida dentro do jogo, só no final (5 perguntas) + envio automático ao Wix (`/_functions/pesquisa`), com fila se estiver sem internet | `pesquisa.js` |
| `travaVoltar` | Botão voltar do navegador: avisa "Sair do jogo? O jogo atual será perdido" (Continuar / Sair) | `trava-voltar.js` |

## Modos

| Modo | Blocos | Para quê |
|---|---|---|
| `combate` | monstros3d, pedraDireita, travaVoltar, telemetria, pesquisa, pacoteObrigatorio | O jogo nos parques |
| `livre` | monstros3d, pedraDireita, joystick, travaVoltar, telemetria, pesquisa | Treino de mira: joga de qualquer lugar |
| `legado` | (nenhum) | Páginas antigas |

## Para mudar algo

- **Ligar ou desligar um bloco num modo:** edite `modos` em `blocos.json` e rode os dois builds.
- **Criar um bloco novo:** ponha o arquivo em `blocos/`, descreva-o em `blocos.json` e inclua-o nos modos que o usam.
- **Criar um modo novo:** acrescente em `modos` e use o nome no build da página.
- **Nunca** edite as páginas geradas (`saida/`) nem enxerte código a mão nelas.

## Cores dos chefões e luz

Ficam no topo de `monstros-3d.js` (`TIPOS`: matiz, claridade, saturação; e a luz da cena).

## Botão voltar (travaVoltar)

- Só arma depois do primeiro toque (regra dos navegadores) e empilha 4 entradas de reserva no histórico, repostas a cada voltar (técnica testada no iPhone, a mesma de `docs/trava-voltar-elemento.js`).
- Ao voltar: aviso **"Sair do jogo? O jogo atual será perdido"** com **Continuar jogando** (fica) e **Sair e perder o jogo** (sai). Os monstros ficam pausados enquanto o aviso está aberto.
- Sem aviso quando não há o que perder: jogo ainda não começou, ou já terminou (tela de parabéns).
- **Para onde sai:** volta no histórico até a página de onde o jogador veio (ex.: a escolha de parques). Se abriu por link ou QR, vai para o endereço do parâmetro `?volta=https://...` ou, na falta dele, para `jogo.html`.

## Download obrigatório (pacoteObrigatorio)

- O botão de começar só libera com o pacote **inteiro**: mapa do parque (zoom 11-14, raio 2 km) + páginas e imagens + biblioteca 3D + modelos. A lista de arquivos vem do catálogo (`offline` e `ativos` de cada bloco) e chega ao jogo em `window.MGO_ATIVOS`.
- **Conferido toda vez** que a página abre (o iPhone apaga dados de sites parados): se faltar algo, pede para baixar de novo.
- O modelo expõe `window.MGO_OFFLINE = { baixar, verificar, registro }` e o evento `mgo:offline` (progresso).
- Só no modo **combate** (o treino livre usa a posição de quem joga, não um parque fixo).

## Pesquisa e telemetria

- Ao terminar a missão, os dados técnicos seguem **sozinhos** e a pesquisa abre (pode pular). Só no final e **obrigatória nesta fase**: não há "agora não". Quem sai sem responder (desistiu, fechou, recarregou) fica com a pesquisa **pendente** no celular, e ela vem antes de tudo na próxima vez que abrir o jogo. Quem desiste (aviso do voltar) ou sai no meio também é registrado.
- Anônimo: sem nome, sem posição. O mesmo `partidaId` atualiza a mesma linha no servidor.
- Envio para `https://www.meuguiaoutdoor.com.br/_functions/pesquisa` (função `post_pesquisa` em `novositemeuguiaoutdoor/src/backend/http-functions.js`, grava na coleção `PesquisasJogo`). Se o servidor não responder, o jogo guarda uma **fila** no celular e envia depois.
