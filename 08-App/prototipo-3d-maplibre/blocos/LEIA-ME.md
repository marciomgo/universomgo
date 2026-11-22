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
| `monstros3d` | Monstros 3D (zumbi Orc_Skull, chefão Demon vermelho, final lilás); anda, ataca, leva dano, morre | `monstros-3d.js` |
| `pedraDireita` | Botões da pedra à direita do estilingue | `layout-pedra-direita.css` |
| `joystick` | Joystick na tela (anda/gira sem GPS), embaixo à esquerda | `joystick.js` |

## Modos

| Modo | Blocos | Para quê |
|---|---|---|
| `combate` | monstros3d, pedraDireita | O jogo nos parques |
| `livre` | monstros3d, pedraDireita, joystick | Treino de mira: joga de qualquer lugar |
| `legado` | (nenhum) | Páginas antigas |

## Para mudar algo

- **Ligar ou desligar um bloco num modo:** edite `modos` em `blocos.json` e rode os dois builds.
- **Criar um bloco novo:** ponha o arquivo em `blocos/`, descreva-o em `blocos.json` e inclua-o nos modos que o usam.
- **Criar um modo novo:** acrescente em `modos` e use o nome no build da página.
- **Nunca** edite as páginas geradas (`saida/`) nem enxerte código a mão nelas.

## Cores dos chefões e luz

Ficam no topo de `monstros-3d.js` (`TIPOS`: matiz, claridade, saturação; e a luz da cena).
