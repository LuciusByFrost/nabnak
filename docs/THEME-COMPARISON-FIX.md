# Diagnóstico da comparação do Original

Continuação com a localização dos três pixels e a correção da rolagem mobile:
[Original: rolagem e rasterização](ORIGINAL-RENDER-DIAGNOSIS.md).

## Evidência disponível

O relatório fornecido marcou `failed` após salvar somente
`desktop-original-tasks.png`. Pelo fluxo do teste, a primeira comparação passou
em Tarefas e a próxima falhou em Calendário. A captura disponível é de Tarefas,
não do par de imagens que divergiu.

O relatório e a captura originais foram preservados em
`artifacts/theme-diagnosis/reported-failure.json` e
`artifacts/theme-diagnosis/reported-desktop-original-tasks.png` antes das novas
tentativas. A captura foi inspecionada; seu fundo no conteúdo é `#F6F6F5`,
compatível com o Original claro. Não há capturas anterior/esperada do calendário
que permitam localizar o pixel divergente.

## Problemas confirmados no teste

1. `Buffer.equals` comparava os arquivos PNG codificados. Isso testa também
   compressão e metadados, em vez de exclusivamente os pixels. Dois PNGs com
   pixels iguais podem reprovar esse teste. Isso foi demonstrado por teste
   automatizado, mas não prova que foi o fator que ocorreu na execução relatada.
2. Desativar `themes.css` desativava também os estilos das novas prévias e do
   seletor na lateral. Portanto a página completa mudava entre as capturas,
   embora o objetivo fosse isolar a influência dos estilos dos temas nos módulos.
3. A falha descartava os buffers comparados. O relatório não identificava o
   módulo, dimensões, pixels diferentes ou estado de renderização.

As regras de pintura dos temas lo-fi são condicionadas a `data-skin` e não
correspondem ao Original. As folhas base `tokens.css`, `style.css`, `planner.css`,
`mindmap.css` e `redesign.css` não receberam mudanças nesta correção. Não foi
encontrada evidência de alteração indevida de cores/fontes/bordas no conteúdo do
Original. Isso é uma análise do código e da captura disponível, não confirmação
de equivalência de pixels em um navegador.

**A causa exata do pixel divergente não pôde ser confirmada.** Faltam o par da
falha original e uma execução de navegador permitida neste ambiente. Os dois
defeitos de comparabilidade foram corrigidos sem atribuir a eles uma reprodução
que não ocorreu.

## Correções

- Estilos das prévias e controles movidos, sem mudar seus valores, para
  `css/theme-picker.css`, mantida ativa nos dois lados da comparação.
- `css/themes.css` agora contém somente as regras dos temas. Desativá-la no
  Original deixa os controles da lateral e suas dimensões intactos.
- Comparação exata de dimensões e pixels RGBA decodificados. Nenhuma tolerância,
  máscara ou exclusão de região foi adicionada.
- Um teste verifica que uma diferença de **1 unidade em 1 canal de 1 pixel**
  reprova; outro verifica que dimensões diferentes e arquivos inválidos não passam.
- Fontes aguardadas, ponteiro em posição neutra e condições de captura iguais.
- Comparação adicional de todos os estilos visuais selecionados e coordenadas
  dos elementos do módulo; diferenças também reprovam.
- Os arquivos `*-actual.png`, `*-expected.png` e `*-state.json` são gravados em
  `artifacts/themes/comparisons/`; quando há pixels diferentes, também é gravado
  `*-diff.png`, com os pixels diferentes em magenta sobre preto.
- O relatório registra módulo, tamanho, número de pixels, maior diferença de
  canal, área divergente, igualdade dos bytes PNG e igualdade dos estilos.
- Uma falha em um cenário não impede a tentativa dos outros temas/dispositivos.
  O resultado geral continua `failed`, com saída diferente de zero, se qualquer
  cenário reprovar. Nenhuma falha é ignorada ou convertida em aprovação.

As paletas e os efeitos Café/Midnight foram preservados. Não houve mudança no
layout estrutural, nas funcionalidades ou nos formatos de dados.

## Testes e limites desta execução

- `npm.cmd test`: **106 aprovados, 0 falhas**.
- Verificação de sintaxe e `git diff --check`: aprovadas.
- O decodificador PNG também leu corretamente a captura real fornecida
  (1440 × 1000, inclusive a cor de fundo observada).
- `npm.cmd run test:themes`: tentado, **blocked**, `spawn EPERM`.
- `npm.cmd run test:browser`: tentado, **blocked**, `spawn EPERM`.
- A tentativa direta com Chromium também terminou com acesso negado ao canal
  Mojo. Playwright e Chromium estão instalados; o bloqueio agora é de execução,
  não de instalação.

**Os três temas em desktop e celular ainda não foram validados aqui.** Os
relatórios novos registram zero verificações de navegador e zero capturas.
Não houve commit ou push.

Para concluir a reprodução no terminal local que já executa o navegador:

```powershell
npm.cmd test
npm.cmd run test:themes
npm.cmd run test:browser
```

Se a comparação continuar falhando, o novo relatório aponta exatamente o par,
o mapa de diferenças e os estilos envolvidos. `pngBytesEqual: false` com
`equal: true` identifica diferença somente de codificação. `equal: false`
continua sendo uma falha visual, mesmo com estilos iguais; os arquivos de
diagnóstico precisam então ser inspecionados.
