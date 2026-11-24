# Personalização visual: Original, Lo-fi Café e Lo-fi Midnight

Atualização das ilustrações: [cenários raster locais, preferência padrão e testes](LOFI-ILLUSTRATIONS.md).

Atualização: consulte [a análise de rolagem e rasterização](ORIGINAL-RENDER-DIAGNOSIS.md)
para a correção mobile, a investigação desktop, 109 testes aprovados e o bloqueio de execução
do Chromium (`spawn EPERM`). A validação visual continua pendente neste ambiente.

Esta etapa acrescenta identidades visuais ao redesign existente. As posições,
grades, dimensões e fluxos dos módulos não foram redesenhados.

## Temas disponíveis

| Tema | Tratamento visual |
| --- | --- |
| Original | Padrão. Mantém os estilos existentes, Nunito, cores, bordas e a escolha anterior entre claro, escuro e sistema. |
| Lo-fi Café | Papel creme, menu bege, cartões marfim, terracota, detalhes sálvia, textura de papel quase imperceptível, títulos principais em Georgia, bordas pontilhadas/tracejadas e sombras curtas. |
| Lo-fi Midnight | Azul noturno, menu profundo, superfícies azuladas, lavanda suave, verde discreto para estados positivos, textura esparsa de chuva e iluminação sutil nas bordas. Sem neon. |

As paletas fornecidas são preservadas nas superfícies e nos destaques. No Café,
terracota `#B77955` é usado em ações com texto escuro; textos pequenos de destaque
usam `#7C492C`. O sálvia `#829477` aparece em detalhes, enquanto o preenchimento
de progresso usa a variação `#647A57`, com contraste superior a 3:1 sobre o trilho.
Essas derivações evitam usar cores decorativas claras como texto funcional.

O seletor existente de aparência continua no mesmo lugar. Logo abaixo, três
botões apresentam miniaturas dos temas e estado selecionado acessível. A troca
é imediata e não recarrega a página. Nos temas lo-fi, o modo claro/escuro é
definido pela identidade; voltar ao Original restaura a preferência anterior.

Ilustrações opcionais agora usam cenários JPEG locais no fundo, no espaço livre
da lateral e no canvas dos mapas. São ativadas por padrão nos temas lo-fi quando
não existe escolha salva; escolhas explícitas de desligar são preservadas.
O Original nunca mostra essas ilustrações, mesmo que a preferência esteja salva.

## Implementação

- `css/themes.css`: variáveis e tratamentos visuais condicionados a `data-skin`.
- `js/theme.js`: aplicação antes da pintura inicial, seleção e persistência.
- `js/shell.js`: sincronização dos controles da seção de aparência.
- `index.html`: folha de estilo e controles inseridos somente em Aparência.
- `js/redesign-translations.js`: textos em português, inglês e espanhol.

As folhas existentes de estilos base, componentes e redesign não foram alteradas
nesta etapa. As regras que pintam os módulos com o estilo lo-fi são condicionais;
não se aplicam ao Original. As cores das ramificações escolhidas pelo usuário
continuam preservadas nos mapas mentais.

Preferências:

| Chave | Conteúdo |
| --- | --- |
| `nabnak.theme` | Modo anterior: `light`, `dark` ou `system`; mantido para o Original. |
| `nabnak.skin` | `original`, `lofi-cafe` ou `lofi-midnight`; Original quando ausente. |
| `nabnak.themeIllustrations` | `true` ou `false`; quando ausente, ligado nos temas lo-fi e desligado no Original. |

As chaves e os formatos de tarefas, metas, idiomas e mapas não foram migrados.
Nenhuma função de negócio foi modificada nesta etapa. Não foi acrescentado
framework nem dependência de produção. Não houve commit ou push.

## UI/UX Pro Max e contraste

A skill local foi lida e suas consultas executaram com Python 3.12.10:

```powershell
python -B .agents/skills/ui-ux-pro-max/scripts/search.py "warm paper retro" --domain style -n 2
python -B .agents/skills/ui-ux-pro-max/scripts/search.py "color contrast" --domain ux -n 2
```

Esses caminhos partem da pasta pai do repositório, onde está `.agents`.
As referências Vintage Analog e E-Ink/Paper foram avaliadas criticamente: somente
papel, calor e detalhes estáticos foram aproveitados. Efeitos VHS, tremor,
vazamentos luminosos e animações decorativas foram descartados.

O cálculo automatizado cobre texto normal em 4,5:1, foco/controles em 3:1 e
preenchimento de progresso em 3:1. Inclui fundo, superfícies, menu, seleção,
estados e botões dos temas lo-fi, além dos pares anteriores do Original.
Isso verifica os tokens; não equivale a uma auditoria integral da renderização.

## Testes executados

- Base anterior: 96 testes aprovados.
- Após a personalização: 104 testes aprovados, sem falhas.
- Cobertura nova: Original padrão e compatibilidade com preferências anteriores;
  troca pelos botões de prévia; seleção única; persistência; sistema operacional;
  ilustrações opcionais; valores desconhecidos; integridade dos dados ao alternar
  nas quatro vistas e nos três idiomas; contraste dos dois novos temas.
- Verificação de sintaxe dos scripts e `git diff --check` aprovadas.

## Playwright: bloqueado no ambiente

**Não houve validação visual nem capturas reais nesta etapa.**

Playwright não está instalado. A tentativa de instalação retornou
`ECONNREFUSED 127.0.0.1:9` ao acessar o registro npm. A execução de
`npm.cmd run test:themes` foi tentada e registrou `blocked`, com zero verificações
de navegador e zero capturas, em `artifacts/themes/report.json`.

A suíte `tests/browser/themes.cjs` está preparada e passou na verificação de
sintaxe. Ela ainda precisa ser executada em um ambiente com Playwright/Chromium.
Foi programada para:

- Exercitar Original, Café e Midnight em desktop 1440 × 1000 e celular emulado
  375 × 812, com dados de teste isolados.
- Percorrer tarefas, calendário, metas e mapas em cada tema, gerando 24 capturas.
- Gerar mais seis imagens das pequenas prévias do seletor.
- Comparar os pixels dos módulos no Original com a nova folha de temas
  desativada; incluir o modo escuro do Original nessa verificação.
- Comparar posições dos componentes ao alternar temas, medir contraste de textos
  renderizados e detectar overflow e controles sem nome acessível.
- Conferir persistência após recarga, ilustrações, idiomas e integridade dos dados.
- Registrar apenas verificações e capturas efetivamente concluídas.

Para executar na pasta que contém `index.html`, com Node.js 24+:

```powershell
npm.cmd install
npx.cmd playwright install chromium
npm.cmd test
npm.cmd run test:themes
npm.cmd run test:browser
```

Use `npm`/`npx` sem `.cmd` em macOS ou Linux. Os PNGs e o relatório serão gravados
em `artifacts/themes/`. A suíte geral usa `artifacts/ui/`. Ambas criam um servidor
local e contextos novos, sem ler o perfil habitual do navegador do usuário.

Depois da execução, revisar as imagens, conferir zoom de 200%, leitor de tela,
teclado virtual e dispositivo físico. A suíte não substitui essa revisão humana.
Até lá, a equivalência de pixels do Original e o resultado visual dos novos temas
permanecem pendentes, embora os estilos base tenham sido preservados.
