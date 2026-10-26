# Agenda Luziane — V9 (correção do login local)

Para testes, a senha interna é `asd123`.

## Executar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal. O Vite agora atende `/api/login`, `/api/session` e `/api/logout` localmente, sem retornar a página HTML no lugar da API.

Na Vercel, as mesmas rotas ficam em `api/`. Não são necessárias variáveis de login para esta demonstração.

**Somente testes:** login com senha fixa não deve proteger dados reais de pacientes. Não use este projeto para informações clínicas ou pessoais reais. A integração protegida com o Supabase ainda não está pronta.


## V10
- Cantos quadrados em toda interface.
- Aviso de modo local removido.
- Ainda requer validação de segurança e armazenamento antes de atender pacientes reais.

## V11 — Novo financeiro
- Filtros por dia, semana (segunda a domingo), mês, ano, total e intervalo personalizado.
- Total recebido por data real de pagamento; valores em atraso e a receber por saldo e vencimento.
- Folha individual por paciente, com total contratado, recebido e saldo restante em vermelho.
- Sessões, avaliações e pacotes; histórico, comprovante individual e lançamento de parcelas.
- Nenhum paciente ou valor fictício pré-cadastrado.
- O relatório financeiro considera pagamentos explicitamente lançados: marcar uma consulta como 'paga' sem lançar recebimento não cria valor em caixa.
- Esta versão usa armazenamento local quando não existe backend: NÃO CADASTRE DADOS REAIS DE PACIENTES antes de concluir autenticação e persistência segura.
