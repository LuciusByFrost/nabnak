# Ambientes ilustrados dos temas lo-fi

## Diagnóstico inicial

A implementação anterior não tinha cenários locais. Usava dois SVGs inline de
36 × 32 px, uma xícara ou uma lua, junto à marca. A preferência começava desligada
quando `nabnak.themeIllustrations` não existia. A captura Café disponível também
mostrava o controle desmarcado. Portanto havia dois fatores concretos: ilustrações
desativadas por padrão e desenhos pequenos demais para transmitir uma atmosfera.
Não havia URL de arquivo de cenário que pudesse ter retornado 404 nessa versão.

## Assets adicionados

Foram geradas e inspecionadas duas ilustrações raster com imagegen, depois
otimizadas em JPEGs locais. Nenhuma imagem externa precisa ser adicionada.

| Tema | Fundo/canvas | Lateral |
| --- | --- | --- |
| Café | `assets/themes/lofi-cafe.jpg`, 1200 × 800 | `assets/themes/lofi-cafe-sidebar.jpg`, 480 × 320 |
| Midnight | `assets/themes/lofi-midnight.jpg`, 1200 × 800 | `assets/themes/lofi-midnight-sidebar.jpg`, 480 × 320 |

Café mostra uma cafeteria com plantas, livros e café, em creme, bege, terracota e
sálvia. Midnight mostra uma cidade silenciosa através de uma janela com gotas
de chuva, índigo, azul-marinho, lavanda e pequenos pontos de luz quente, sem neon.
Os quatro arquivos juntos têm aproximadamente 568 KiB.

## Integração visual

- Uma camada fixa decorativa mostra a cena nas áreas livres do fundo, com
  máscara suave nas bordas e escala menor no celular.
- A lateral usa a versão leve no preenchimento que já existia entre navegação
  e preferências. ResizeObserver mede o espaço disponível e muda somente a
  extensão da pintura, limitada a 184 px de altura. Não acrescenta margens,
  elementos ou altura ao layout, e não sobrepõe os controles.
- O canvas dos mapas recebe a mesma cena com menor opacidade. Os nós continuam
  opacos, e o padrão de navegação e os gestos não foram alterados.
- Cartões, campos e formulários mantêm suas superfícies opacas. Filtros e títulos
  de calendário recebem fundo sólido onde poderiam cruzar a decoração.
- Todas as camadas são estáticas, não capturam ponteiros e ficam fora da árvore
  de acessibilidade. Máscaras/gradientes servem para misturar os JPEGs ao fundo;
  não substituem as ilustrações por formas CSS.
- Nenhuma regra dessas camadas corresponde ao tema Original. A aparência e o
  texto anterior do controle no Original foram preservados.

## Preferências e dados

Sem preferência salva, as ilustrações ficam ligadas em Café/Midnight e desligadas
no Original. Um `false` salvo explicitamente continua desligando as cenas; um
`true` continua sendo respeitado. Ausência de preferência não é gravada como uma
escolha do usuário. O checkbox em **Aparência → Ilustrações de ambiente** alterna
todas as camadas imediatamente e persiste a escolha na chave existente.

Nenhuma chave ou formato de tarefas, metas, mapas ou idiomas foi migrado. Nenhum
framework foi acrescentado. As alterações de lógica se limitam às preferências
e à colocação da decoração; não modificam fluxos de trabalho.

## UI/UX Pro Max

A skill foi consultada com `background image readability --domain ux` e retornou
a orientação de contraste. Ela embasou a decisão de manter as imagens longe das
superfícies de leitura, preservar a hierarquia e reservar a arte para os espaços
livres. O segundo resultado, sobre números, não era pertinente e não foi usado.
As paletas solicitadas foram mantidas. imagegen foi usada para criar assets raster
reais, em vez de ampliar os pequenos símbolos SVG existentes.

## Compatibilidade e testes

- **113 testes aprovados**, sem falhas, incluindo os testes anteriores.
- JPEGs verificados por assinatura, dimensões, integridade e orçamento de tamanho.
- Os quatro assets foram efetivamente servidos por HTTP com status 200,
  `Content-Type: image/jpeg` e conteúdo idêntico ao arquivo local.
- Referências relativas verificadas para `/`, `/nabnak/` e `/projects/nabnak/`,
  cobrindo a resolução de caminhos usada por Live Server e GitHub Pages.
- Novos testes verificam o padrão ligado para novas preferências, persistência
  da escolha de desligar, compatibilidade com preferências anteriores e dados.
- Sintaxe e `git diff --check` aprovados.
- A suíte Playwright foi atualizada para decodificar as imagens reais no browser,
  verificar suas dimensões e a alternância/desligamento após recarga.
- A execução do Playwright foi tentada, mas Chromium continua bloqueado neste
  ambiente por `spawn EPERM`. As ilustrações geradas foram inspecionadas, mas
  **a composição dentro da aplicação em desktop/mobile ainda não foi validada
  visualmente aqui**. Nenhuma nova captura da interface foi produzida.

Para validar localmente:

```powershell
npm.cmd test
npm.cmd run serve
npm.cmd run test:themes
```

Na conferência manual, ativar Café/Midnight, usar uma janela alta e outra pequena,
recolher a lateral, abrir mapas, alternar as ilustrações e ampliar o texto. O
Original deve continuar sem cenas. O teste de repetibilidade do Original permanece
estrito; esta etapa não altera suas condições ou tolerâncias.

Os JPEGs já estão no projeto e serão publicados com os arquivos estáticos.
Não houve commit ou push.
