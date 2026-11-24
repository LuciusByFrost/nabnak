# Calendário e metas

> O redesign passou a apresentar calendário, metas e mapas como vistas principais.
> Consulte [REDESIGN.md](REDESIGN.md) para os 96 testes atuais, a execução
> progressiva, temas, filtros e instruções de validação Playwright. A conferência
> visual permanece pendente por bloqueio do ambiente. As instruções históricas
> abaixo descrevem a implementação anterior com diálogos e hover nos cartões.

O projeto continua sendo HTML/CSS/JavaScript estático, sem backend ou dependências.
Abra `index.html`. O idioma continua em `nabnak.language`; tarefas e metas ficam
em `nabnak.data`. A versão 2 migra registros da versão 1 sem recriar os exemplos.
Excluir uma meta desvincula suas tarefas, sem excluí-las. Os exemplos só são
inseridos quando ainda não existe um registro de tarefas.

## Testes automatizados

Com Node.js 24, na pasta do projeto:

```powershell
node --test --test-isolation=none tests/store.test.cjs tests/ui.test.cjs tests/translations.test.cjs tests/task-form.test.cjs
```

A opção de isolamento permite executar os testes mesmo em ambientes que bloqueiam
processos filhos. Nenhuma dependência precisa ser instalada.

Na etapa 1, foram executados 14 testes de calendário/dados/integração antes de
iniciar as metas. A suíte final acrescenta metas, migração e verificações cruzadas.
Os testes de interface executam os scripts reais sobre um DOM mínimo simulado
(`tests/dom-harness.cjs`), com o HTML real e armazenamento em memória compartilhado
entre recargas. Eles verificam eventos e dados, não renderização de CSS, validação
nativa dos formulários, captura nativa do foco em diálogos, toque ou gestos reais.

Também executar `node --check` nos arquivos JavaScript e `git diff --check`.

## Conferência em navegador

Ainda é necessária a conferência visual em um navegador, pois o ambiente de
implementação bloqueou a execução do Chrome:

1. Em larguras de 320, 375, 768 e 1280 pixels, conferir o formulário no topo,
   centralizado, sem sobrepor o botão da sidebar; em telas pequenas as colunas
   devem se empilhar. Abrir/fechar a sidebar (X, fundo e Esc), conferir as duas
   direções do slide e a preferência por movimento reduzido.
2. Abrir Calendário. Navegar entre meses e anos, selecionar um dia, criar uma
   tarefa, mudar/remover sua data e conferir os marcadores. Conferir fevereiro
   bissexto, tarefas atrasadas, de hoje e concluídas.
3. Pelo lápis de uma tarefa ou pelo formulário superior, escolher uma meta.
   Criar uma meta com prazo e quantidade; associar uma tarefa existente e criar
   outra pelo painel da meta. Mover tarefas para Concluído e de volta; conferir
   barra, contagem, porcentagem e estados de prazo/conclusão.
4. Cancelar e confirmar a exclusão de uma meta. Conferir que suas tarefas
   continuam no quadro. Editar tarefas pelo editor; cancelar e confirmar a exclusão
   pelo X do cartão. No desktop, conferir o fade dos dois ícones ao entrar/sair
   com o mouse e o acesso via Tab. No celular, conferir que lápis e X permanecem
   visíveis, sem cobrir o texto, e respondem ao toque sem iniciar arraste. Conferir
   os seletores de prazo e meta abrindo abaixo do formulário superior.
5. Recarregar: tarefas, datas, colunas, metas, vínculos e idioma devem permanecer
   sem duplicações. Mudar idioma e conferir que títulos/descrições do usuário
   continuam iguais.
6. Usar Tab/Shift+Tab/Enter/Esc, os seletores nativos de data e os controles pelo
   toque. Conferir foco ao fechar os diálogos e concluir edições. Em celular,
   mover tarefas pelo seletor de coluna, sem depender de drag and drop.

Dados ilegíveis ou de uma versão futura não são sobrescritos; a interface mostra
um aviso e permite uso na sessão. Falhas de gravação também geram aviso.
