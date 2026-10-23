# Teste de aceitação com banco isolado

Execute `npm run test:e2e` na raiz do backend. O comando compila o código atual antes de executar o roteiro.

É necessário ter MySQL acessível e configurar `DB_HOST`, `DB_PORT`, `DB_USERNAME` e `DB_PASSWORD` pelo ambiente ou pelo arquivo local `.env`. A conta precisa de permissão para criar e remover um banco temporário. Nenhuma senha deve ser inserida neste documento ou versionada.

O roteiro cria um banco novo com nome aleatório no formato `escala_acceptance_<timestamp>_<sufixo>`, substitui `DB_DATABASE` e `JWT_SECRET` somente no processo de teste e só então importa a aplicação. A sincronização de entidades é executada exclusivamente nesse banco recém-criado. Nenhuma migration é aplicada ao banco de uso normal. Ao terminar, inclusive em caso de falha, o roteiro fecha a aplicação e remove somente o banco criado por essa execução. Em caso de encerramento forçado do processo, um banco temporário pode permanecer e deve ser conferido antes de uma limpeza manual.

O teste usa autenticação JWT real, quatro perfis, duas unidades, usuários sintéticos, três calendários completos e requisições HTTP pelos controllers. São exercitados permissões, troca de senha obrigatória, revogação de token, preparação transacional, privacidade da inaptidão, cotas, interrupção, retomada, último automático, alterações após encerramento, permutas, indeferimento, relatórios, auditoria e arquivamento.

Os cenários de vencimento alteram somente os prazos sintéticos do banco temporário e acionam explicitamente o mesmo serviço usado pelo agendador. A rotina de encerramento de reivindicação e o ajuste de sobras incompatíveis também são exercitados. Isso dispensa aguardar 24 horas durante o teste.

O MySQL temporário recebe o esquema das entidades atuais. Este teste não valida a evolução por migrations de bancos antigos. Não substitui testes do navegador, impressão/PDF/CSV, acessibilidade, carga ou concorrência entre requisições simultâneas.
