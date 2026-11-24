# Original: rolagem mobile e rasterização do calendário

## Evidência preservada

O relatório local recebido contém 21 capturas, quatro cenários lo-fi aprovados e
duas falhas no Original. Foi preservado em
`artifacts/theme-diagnosis-2/input-report.json`, com os comparativos recebidos em
`artifacts/theme-diagnosis-2/input-comparisons/`.

Foram lidos os estados e decodificados os PNGs actual/expected/diff. Também foram
inspecionadas as imagens completas e ampliações do canto afetado. As ampliações
estão em `artifacts/theme-diagnosis-2/calendar-actual-zoom.png` e
`calendar-expected-zoom.png`.

## Falha mobile: causa comprovada e correção

O comparativo de pixels de tarefas mobile passou: zero pixels diferentes e
estados iguais. A falha seguinte estava na comparação geométrica entre momentos
distintos do teste:

1. `positions = geometry(...)` era obtido antes da captura, com o cabeçalho em
   `y = 72` no viewport.
2. `originalPixels()` chamava `scrollIntoViewIfNeeded()` e `locator.screenshot()`.
   O módulo mede 1714,828125 px de altura, maior que o viewport de 812 px. Essas
   operações podem rolar a página para capturá-lo.
3. O estado gravado depois da captura mostra `scrollX = 0`, `scrollY = 71`,
   viewport 375 × 812 e a raiz `.workspace` em `[12, 1, 351, 1714.828125]`.
4. A geometria posterior ainda era lida com essa rolagem, enquanto a geometria
   inicial tinha sido lida antes dela. Por isso todos os dez elementos tinham
   `deltaY = -71`, sem mudança em X, largura ou altura.

`getBoundingClientRect()` fornece coordenadas relativas ao viewport. Portanto
`documentY = viewportY + scrollY = 1 + 71 = 72`. O conteúdo não se moveu no
documento. Não é um cabeçalho sticky: `.workspace-header` permanece no fluxo
normal. A navegação aplica foco ao título, mas o foco registrado no comparativo
permanece `workspace-title`; a operação adicional entre as medições era a captura
com rolagem. Não foi alterado o foco do aplicativo para contornar o teste.

A instrumentação anterior registrava a janela somente depois da captura e não
preservava os offsets dos contêineres. A nova registra e restaura ambos.

### Correção somente no teste

- `tests/browser/capture-state.cjs` salva janela, viewport visual, DPR e offsets
  dos elementos com conteúdo rolável, incluindo a lateral e áreas internas.
- Capturas e comparações do Original executam em um bloco com restauração em
  `finally`, inclusive ao falhar uma asserção.
- A origem de rolagem é salva antes da primeira medição. Depois de capturas,
  cliques e foco no seletor, os offsets são restaurados antes da medição seguinte.
- A restauração usa rolagem instantânea, aguarda dois quadros e é verificada por
  igualdade exata. Se o navegador não conseguir restaurar os offsets, o teste
  falha antes de comparar posições.
- As coordenadas comparadas continuam sendo os retângulos no viewport. Não se
  subtrai 71 px dos resultados nem se altera CSS para compensar o deslocamento.
- A lista `geometries` do relatório inclui offsets anteriores/posteriores e
  ambas as listas de coordenadas. Fontes também são aguardadas antes da medição.

Dois testes de regressão verificam a restauração do caso de 71 px, offsets
horizontais e internos, e a restauração mesmo quando a comparação lança erro.

## Falha desktop: localização comprovada, mecanismo ainda não confirmado

Ambos os estados recebidos são idênticos: rolagem `[0, 0]`, viewport 1440 × 1000,
DPR 1, fontes carregadas e foco em `calendar-title`.

A origem do recorte é `[256, 24]`. Os três pixels decodificados são:

| X/Y no PNG | Actual RGBA | Expected RGBA |
| --- | --- | --- |
| 121 / 494 | 184, 108, 53, 255 | 184, 108, 52, 255 |
| 121 / 496 | 169, 75, 8, 255 | 169, 76, 9, 255 |
| 123 / 496 | 249, 230, 210, 255 | 250, 229, 209, 255 |

Eles estão no canto superior esquerdo arredondado do contorno do dia 23,
selecionado. O botão está em `[377.1875, 512.5, 98.1875, 76]`, com raio de 8 px,
borda de 1 px e outline de 2 px. Borda e outline usam `rgb(169, 75, 8)` e o fundo
usa `rgb(255, 240, 223)`, igualmente nos dois estados.

Isso elimina a hipótese de mera diferença de compressão/metadados PNG para esta
falha: a diferença existe nos pixels. Não está em um glifo, portanto não é
antialiasing de texto. A localização e os deltas são compatíveis com cobertura de
antialiasing e arredondamento/composição de cores da borda em coordenadas
fracionárias. **Uma única dupla não demonstra se a variação é repetível, se é
instabilidade do Chromium ou se depende do histórico de repintura/composição.**
Não foi alterado raio, posição fracionária, cor, outline, aceleração gráfica ou
escala para forçar igualdade. Nenhuma tolerância foi adicionada.

### Repetibilidade sem escolher quadros favoráveis

Cada comparação do Original agora produz cinco amostras consecutivas em cada
estado: folha ativa, folha desativada e folha restaurada. São salvos todos os 15
quadros, com hashes dos pixels RGBA e métricas das comparações. Não há loop que
repita até encontrar uma imagem que passe.

- Cada repetição é comparada exatamente com a primeira do próprio estado.
- A primeira imagem ativa continua sendo comparada com a primeira desativada.
- A imagem restaurada também deve ser exatamente igual à imagem ativa inicial.
- Todas as comparações e estados precisam passar. Um único canal diferente em
  um único pixel continua reprovando.
- Se um estado varia sem mudar a folha, o relatório acusa instabilidade dentro
  do próprio estado. Se cada estado é estável, mas diferem entre si, permanece
  uma falha entre estados, que precisa ser investigada pelos artefatos.
- O estado inclui offsets internos, posição CSS, outline-offset e atributos do
  dia selecionado. O relatório registra também a versão do navegador.

Um teste de regressão confirma que uma sequência com quatro quadros iguais e
uma diferença de um canal em outro quadro é considerada instável, sem descartar
o quadro divergente.

## Resultado desta execução

- `npm.cmd test`: **109 aprovados, zero falhas**.
- Sintaxe dos scripts alterados e `git diff --check`: aprovados.
- `npm.cmd run test:themes` e `npm.cmd run test:browser`: tentados, ambos
  bloqueados ao iniciar Chromium (`spawn EPERM`).
- A série de 15 quadros não pôde ser produzida neste ambiente. A repetibilidade
  do caso desktop continua pendente; não foi declarada corrigida.
- Os temas Café/Midnight continuam aprovados conforme o relatório local
  recebido. Nenhuma folha CSS, paleta, layout ou função do aplicativo foi
  alterada nesta correção. Hashes das folhas foram registrados em
  `artifacts/theme-diagnosis-2/stylesheet-hashes.json`.
- Não houve commit ou push.

Para produzir a repetição no ambiente local que permite executar Chromium:

```powershell
npm.cmd run test:themes
```

O relatório em `artifacts/themes/report.json` terá `repeatability`, `geometries`
e as referências de todos os quadros. Uma eventual falha desktop continuará
retornando código de saída diferente de zero.
