# Auditoria funcional, UI e UX com Playwright

Data: 6 de outubro de 2026
Escopo: login, dashboard, projetos, visão do projeto, artigos e configurações, em desktop e mobile.

## Resultado executivo

Os fluxos principais exercitados estão funcionais, sem erros de página ou console nos cenários automatizados. A revisão corrigiu os problemas de maior impacto encontrados: tabela de projetos sobreposta, largura quebrada no mobile, título encoberto pelo menu, linha de projeto inacessível por teclado e um painel de pré-visualização sem uso real.

A aplicação está tecnicamente preparada para a configuração de produção, mas o go-live ainda depende de DNS/TLS, OAuth Client ID real do Google e credenciais reais para os testes externos de Google e DeepSeek.

## Jornada verificada

1. **Login Google — saudável.** A tela apresenta uma única forma de entrada e título semântico. Evidências: [desktop](playwright-2026-10-06/desktop-chromium-01-login.png) e [mobile](playwright-2026-10-06/mobile-chromium-01-login.png).
2. **Dashboard — saudável.** Navegação, métricas e responsividade carregam sem erro. Evidências: [desktop](playwright-2026-10-06/desktop-chromium-02-dashboard.png) e [mobile](playwright-2026-10-06/mobile-chromium-02-dashboard.png).
3. **Lista de projetos — saudável após correções.** Desktop usa tabela sem colisão; mobile usa cartões legíveis; projetos podem ser abertos por mouse, Enter ou Espaço. Evidências: [desktop](playwright-2026-10-06/desktop-chromium-03-projects.png) e [mobile](playwright-2026-10-06/mobile-chromium-03-projects.png).
4. **Visão do projeto — saudável.** Cabeçalho, indicadores e abas funcionam nos dois viewports. Evidências: [desktop](playwright-2026-10-06/desktop-chromium-04-project-overview.png) e [mobile](playwright-2026-10-06/mobile-chromium-04-project-overview.png).
5. **Artigos — funcional, com oportunidade de desempenho.** Conteúdo e ações carregam; a página ainda renderiza até 100 artigos simultaneamente. Evidências: [desktop](playwright-2026-10-06/desktop-chromium-05-project-articles.png) e [mobile](playwright-2026-10-06/mobile-chromium-05-project-articles.png).
6. **Configurações/DeepSeek — saudável.** O fluxo deixa claro que a chave é opcional, mostra somente valor mascarado e permite substituição ou exclusão. Evidências: [desktop](playwright-2026-10-06/desktop-chromium-06-settings.png) e [mobile](playwright-2026-10-06/mobile-chromium-06-settings.png).

## Melhorias aplicadas

- Login restrito ao Google, com sessão por cookie seguro e proteção CSRF.
- Chave DeepSeek removida do ambiente compartilhado e movida para cofre criptografado por usuário.
- Menu mobile e menu de conta receberam nomes acessíveis.
- Cabeçalhos agora reservam espaço para o botão do menu no mobile.
- Lista de projetos ganhou apresentação específica para mobile e interação por teclado no desktop.
- Remoção do `ProjectQuickViewPanel` e de estado morto que não participavam da navegação real.
- Testes aguardam conteúdo real em vez de registrar telas ainda em carregamento.

## Riscos e recomendações

- **Antes do go-live:** executar login Google real com conta nova e legada, pois não há Client ID/DNS/TLS disponíveis no ambiente auditado.
- **Antes do go-live:** salvar e usar uma chave DeepSeek de teste real, verificando uma chamada completa e o custo associado.
- **Curto prazo:** paginar ou virtualizar a lista de artigos. Cem itens simultâneos tornam a página muito alta e podem degradar dispositivos modestos.
- **Curto prazo:** adicionar um estado vazio explicativo aos gráficos do dashboard quando ainda não existem dados.
- **Operação:** monitorar 5xx, latência, falhas de readiness e consumo dos provedores depois da liberação.

## Limites da auditoria

O cenário autenticado local usa um token de sessão assinado pelo próprio backend somente na configuração do teste; não existe bypass de autenticação no produto. A verificação cobriu papéis acessíveis, navegação por teclado dos projetos, responsividade e erros de execução, mas não substitui uma auditoria WCAG completa com leitor de tela e medição formal de contraste.
