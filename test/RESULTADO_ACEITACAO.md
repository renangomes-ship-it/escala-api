# Validação funcional — 22/10/2026

## Resultado

Após duas correções, a verificação automatizada passou com 27 suítes e 93 testes unitários, além de uma suíte de integração que executa 45 cenários HTTP. Build NestJS e ESLint dos arquivos de produção alterados aprovados. Frontend com lint completo e build TypeScript/Vite aprovados, com 101 módulos transformados.

Referência inicial: backend `387d386` e frontend `683b27f`. As correções e o novo roteiro descritos aqui foram aplicados depois desses commits e ainda precisam ser versionados.

## Ambiente e proteção

- MySQL real, banco temporário exclusivo criado para cada execução.
- NestJS real, validação de DTOs e autenticação JWT real, sem substituir guards ou repositórios.
- Perfis Master, comandante, escalante e oficial; duas unidades e usuários sintéticos.
- Três calendários de 30 dias, incluindo cenário normal, vencimentos e ajuste manual.
- Senhas e segredo JWT gerados em memória e descartados; não incluídos nos resultados.
- Banco temporário removido no encerramento de cada rodada. Nenhum registro do banco normal foi usado para gravações de teste.

## Cobertura aprovada

| Área | Comportamentos exercitados |
| --- | --- |
| Acesso | Rejeição sem autenticação, rejeição de perfil forjado no login, escalante sem gestão do efetivo, comandante restrito à própria unidade, ausência de senha nas consultas |
| Efetivo e unidades | Alternância Oficial/Escalante, proibição de promover Master pelo comandante, transferência pelo Master, inativação/reativação, token recusado após inativação |
| Senhas | Cadastro com troca obrigatória, bloqueio enquanto pendente, troca com senha atual, token anterior revogado e novo token funcional |
| Preparação | Calendário de 30 dias, cotas e fila, primeiro prazo de 24 horas, prevenção de duplicidade por unidade/período, reversão integral quando cotas inválidas |
| Aptidão e privacidade | Oficial inapto rejeitado antes e depois do encerramento; justificativa pessoal ausente nas respostas para oficiais |
| Escolha | Rejeição fora do turno, cotas incompletas, cor bloqueada, reivindicação de uma hora, interrupção e retomada, último oficial automático com todas as 60 vagas ocupadas sem dupla função |
| Ajustes | Bloqueio de serviço extra para finalizado, ajuste para vaga livre preservando cotas e dois registros por movimentação, fila concluída ainda protegida antes do encerramento |
| Pós-escolha | Alteração sem compensação de cotas, justificativa obrigatória, cor liberada, inapto ainda bloqueado |
| Permutas | Substituição simples e troca vinculada completas, aceite do destinatário, homologação e atualização das duas pontas, motivo de indeferimento obrigatório e preservado |
| Conflitos | Aprovação simples e vinculada recusadas se uma mudança entre pedido e homologação passou a causar dupla função; ocupante e status pendente preservados |
| Relatórios e auditoria | 30 dias, 60 vagas, inapto contabilizado, dados de autenticação ausentes, acesso administrativo, eventos atribuídos ao escalante autenticado |
| Arquivamento | Edição, reabertura e exclusão bloqueadas inclusive para Master; consulta preservada para comandante e ocultada de oficiais |
| Vencimentos | Avanço automático do turno comum, reivindicante vencido ao fim da fila, retomada do interrompido e segundo prazo vencido aguardando intervenção |
| Ajuste manual | Sobras incompatíveis geram pendência; conclusão incompleta recusada; realocação e intervenção do escalante concluem as seis cotas, retornando a escala a ABERTA |

## Falhas reproduzidas e corrigidas

1. A API aceitava `FECHADA` mesmo com integrantes ainda escolhendo. A alteração agora exige fila existente e todos os registros finalizados antes de sair de uma escolha aberta para fechada ou publicada. A condição da interface passa a ser exigida também pelo servidor.
2. Uma permuta válida no pedido podia se tornar inválida se a outra função do dia mudasse antes da homologação. As aprovações simples e vinculadas agora conferem novamente a outra função. A substituição simples também grava serviço e estado da permuta na mesma transação.

A primeira comparação automática do prazo de reivindicação foi ajustada para tolerar até 1,5 segundo de precisão de armazenamento do campo MySQL `datetime`. A repetição confirmou o prazo de uma hora; não foi necessário mudar a duração de negócio.

## Evidência visual e limites

Renan informou em 22/10/2026 que concluiu os testes manuais das últimas correções e a revisão visual dos quatro perfis, sem identificar novos erros. Essa evidência é declarada pelo usuário; a rodada automatizada descrita neste documento usa requisições HTTP, sem percorrer telas no navegador.

O teste não cobre impressão ou downloads CSV/PDF, acessibilidade, carga, requisições concorrentes, evolução de bancos antigos por migrations nem entrega de notificações no navegador. O agendador é acionado diretamente nos testes de vencimento, com prazos sintéticos; não se aguarda 24 horas reais. A suíte verifica o fluxo de negócio e não representa garantia de ausência de qualquer falha.

## Reprodução e próximo marco

Execute `npm test -- --runInBand` para os testes unitários e `npm run test:e2e` para a aceitação com banco isolado. Consulte [ACCEPTANCE.md](ACCEPTANCE.md) para os requisitos de ambiente.

Próximo marco: revisar e versionar as correções e este roteiro; depois validar exportações e documentação da entrega. Nenhuma nova tag, publicação ou envio ao GitHub foi realizado nesta rodada.
