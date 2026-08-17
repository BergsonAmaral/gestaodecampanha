# SIGC — Sistema Integrado de Gestão de Campanha

Ambiente central de administração, organização e acompanhamento de uma campanha eleitoral.
Interface clara e objetiva, com mapa territorial interativo e gráficos dinâmicos.

## Como começar

Abra `index.html` no navegador — não há build, dependências nem instalação.
Se preferir servir por HTTP:

```bash
python3 -m http.server 4321
```

A plataforma **nasce vazia**. Na primeira abertura ela leva para *Primeiros passos*:

1. **Identificar a campanha** — candidatura, município e data da eleição.
2. **Cadastrar o território** — regiões e bairros com o eleitorado estimado. O mapa é desenhado
   a partir dos bairros cadastrados; as metas e os relatórios territoriais nascem daí.
3. **Montar a estrutura** — quem coordena, quem supervisiona, quem está em campo.
4. **Cadastrar pessoas** — cada contato com origem, território e responsável.
5. **Colocar a operação para andar** — tarefas com prazo, eventos com resultado registrado.

Em *Configurações* há uma **base de demonstração** (campanha fictícia completa) para conhecer
as telas antes de começar. Ela apaga o que existir e pode ser removida com “Zerar a base”.

## Onde os dados ficam

| Modo | Quando usar | Como funciona |
|---|---|---|
| **Local** (padrão) | testes, uso de uma pessoa só | tudo no `localStorage` deste navegador; exporte backup com frequência |
| **Supabase** | uso real, com equipe | Postgres compartilhado, autenticação e regras de acesso por perfil |

O modo local não serve para a campanha inteira: cada navegador teria a sua própria base, e o
limite de armazenamento fica perto de 5 MB (a base de demonstração, com 930 pessoas, ocupa
cerca de 730 KB). Para a equipe trabalhar junto, conecte o Supabase.

### Ligando o Supabase

1. Crie um projeto em supabase.com.
2. No *SQL Editor*, execute na ordem: `supabase/01_schema.sql` e depois `supabase/02_rls.sql`.
   O segundo é obrigatório — é ele que impede que a chave pública dê acesso a tudo.
3. Opcionalmente rode `supabase/99_testes_rls.sql`, que verifica em transação (e desfaz no
   final) se cada perfil enxerga exatamente o que deve.
4. Em *Configurações → Banco de dados*, informe a URL do projeto e a chave *anon*, teste a
   conexão, entre com seu usuário e sincronize.

As escritas feitas nas telas entram numa fila local e sobem para o banco; sem internet elas
ficam guardadas e são enviadas quando a conexão volta.

### Acesso por convite (o site não é gratuito — alguém decide quem entra)

O sistema tem três papéis fora do dia a dia da campanha:

- **Superadmin** (você): administra a plataforma. Não pertence a nenhuma
  campanha e não vê dados de campanha nenhum — só convida quem vira
  coordenação geral.
- **Coordenação geral de uma campanha**: quem usa o sistema para a própria
  eleição, preenche os dados reais (candidatura, município, data da eleição)
  e convida o resto da equipe.
- **Resto da equipe**: entra por um link gerado pela própria coordenação
  geral, em **Acessos**.

Os dois convites funcionam do mesmo jeito — o link é o próprio código de
acesso, não existe pareamento por e-mail que possa ser digitado errado:

1. Quem convida (superadmin, ou coordenação geral para a própria equipe)
   gera um link e manda por WhatsApp, e-mail etc.
2. Quem recebe abre o link, escolhe o próprio e-mail e senha.
3. No convite do **superadmin**, isso já libera o acesso na hora, como
   coordenação geral de uma campanha nova e vazia — os dados reais da
   campanha são preenchidos depois, em Configurações.
4. No convite da **coordenação geral para a equipe**, criar a conta não
   libera o acesso sozinho: a pessoa fica "aguardando aprovação" até a
   coordenação geral clicar em **Aceitar** em Acessos — evita liberar acesso
   para quem abriu o link errado por engano.

**Configuração (uma vez só, no SQL Editor, nesta ordem):**
1. `01_schema.sql` e `02_rls.sql` (estrutura e políticas).
2. `05_superadmin.sql` (cria a tabela de administradores da plataforma).
3. `06_convites.sql` e `07_convite_por_link.sql` (convite do superadmin para
   um novo coordenador, por link).
4. `08_convites_equipe.sql` (convite da coordenação geral para a própria
   equipe, por link, com aceite).
5. Crie a **sua própria conta** direto em Authentication → Users no painel
   do Supabase.
6. Rode uma vez, trocando o e-mail:
   ```sql
   insert into plataforma_admins (user_id, nome)
   select id, 'Seu nome' from auth.users where email = 'seu-email@exemplo.com';
   ```
7. Entre no sistema com essa conta — você cai direto no painel de
   administração, não no sistema de campanha. Gere ali o primeiro link de
   coordenação geral.

Se o projeto do Supabase exigir confirmação por e-mail (padrão), a pessoa
recebe um aviso para confirmar e, ao abrir o mesmo link de novo depois de
confirmar, a ativação é concluída automaticamente.

### Perfis de acesso (seção 28 do documento)

Seis perfis, aplicados em duas camadas: o **banco** recusa os dados que a pessoa não pode
ver (políticas do Postgres) e a **interface** esconde o que ela não pode usar.

| Perfil | Enxerga | Escreve | Administra acessos |
|---|---|---|---|
| `coordenacao_geral` | toda a campanha | sim | **sim — só ele** |
| `coordenacao_area` | toda a campanha | sim | não |
| `coordenacao_territorial` | pessoas, tarefas e operação da sua região | sim | não |
| `supervisor` | a equipe que responde a ele, em qualquer profundidade | sim | não |
| `mobilizador` | os próprios contatos e as próprias tarefas | sim | não |
| `leitura` | toda a campanha | **não** | não |

A hierarquia do supervisor sai de `equipe_campanha.responde_a` e é percorrida por uma
consulta recursiva no banco — quem responde a quem define o que cada um enxerga.

O arquivo `99_testes_rls.sql` verifica dez situações reais (coordenação geral vê tudo,
territorial vê só a região, mobilizador vê só o seu, supervisor vê a equipe abaixo,
leitura é bloqueada na escrita). Rode-o depois de qualquer alteração nas políticas.

Em **Sistema → Acessos**, a coordenação geral registra quem usa o sistema, com qual perfil
e — no caso territorial — em qual região. Como a criação de usuários exige o painel do
Supabase, cada registro traz o comando SQL pronto que faz o vínculo entre o usuário criado
e a campanha.

Em **Configurações → Perfil em uso**, no modo local, é possível pré-visualizar o sistema
como outro perfil, para conferir o que cada pessoa verá antes de dar o acesso. É
pré-visualização de tela: a proteção real dos dados é a do banco.

## Como o sistema está organizado

O menu segue a natureza do trabalho, não a ordem do documento:

**Acompanhar** — leitura da campanha (é aqui que os gráficos vivem)
| Tela | Seção |
|---|---|
| Painel geral · sala de situação | 24 |
| Alertas | 25 |
| Mapa territorial | 7 |
| Mobilização | 13, 14 |
| Performance | 23 |
| Financeiro gerencial | 21 |
| Pesquisas | 22 |
| Relatórios (8 relatórios com gráfico + tabela) | 27 |

**Cadastros** — o que a campanha registra (sem gráficos: número, filtro e tabela)
| Tela | Seção |
|---|---|
| Pessoas · lista e ficha-prontuário | 2, 3, 4, 5 |
| Lideranças | 6 |
| Territórios · base cadastral e ficha do bairro | 7 |
| Equipes e núcleos | 8, 9 |
| Materiais | 19 |
| Veículos e recursos | 20 |

**Ação** — o que a campanha faz (quadros, listas e contadores)
| Tela | Seção |
|---|---|
| Tarefas · quadro, lista e etapas | 10, 11 |
| Agenda | 18 |
| Eventos | 17 |
| Demandas | 16 |
| Metas | 12 |
| Dia da eleição | 26 |

Perfis de acesso (seção 28) ficam no rodapé do menu lateral.

O histórico (seção 29) percorre todo o sistema: cada pessoa, demanda, tarefa e evento
guarda quem registrou, quando e qual foi o encaminhamento.

## Organização dos arquivos

```
index.html                  página única do sistema
assets/css/app.css          identidade visual (tema claro padrão + tema escuro)
assets/js/icons.js          ícones Lucide embutidos (sem CDN)
assets/js/util.js           utilitários (DOM, formatação, datas, armazenamento)
assets/js/geo.js            geração do mapa do município (diagrama de Voronoi)
assets/js/modelo.js         estado da campanha, gravação local e consultas gerenciais
assets/js/supabase.js       adaptador do banco (PostgREST + Auth), fila de sincronização
assets/js/demo.js           gerador da base de demonstração (opcional)
assets/js/charts.js         gráficos SVG: linha, barras, rosca, funil, anel, radar,
                            calendário de intensidade, rede de indicações
assets/js/map.js            mapa territorial interativo (camadas, zoom, legenda)
assets/js/ui.js             componentes: cartões, KPIs, tabelas, filtros, abas
assets/js/view-*.js         as telas do sistema
supabase/01_schema.sql      tabelas, índices e visões gerenciais
supabase/02_rls.sql         políticas de acesso por perfil
supabase/99_testes_rls.sql  verificação das políticas
assets/js/app.js            navegação, rotas, busca global e tema
```

## O que as telas fazem de verdade

As ações não são decorativas: alteram a base em memória e a tela reflete o resultado
na hora (indicadores, quadros, alertas e o contador do menu lateral).

- Cadastrar pessoa (botão **Registrar**) → cria o registro, inicia o histórico e abre a ficha.
- Na ficha: registrar contato, abrir demanda e alterar o estágio de relacionamento.
- Criar tarefa, marcar etapas concluídas (a situação e o percentual se recalculam sozinhos).
- Criar evento e, depois dele, registrar público, cadastros, apoiadores e avaliação.
- Criar núcleo, meta, compromisso de agenda, lançamento financeiro e recurso.
- Movimentar estoque: entrada e saída, com bloqueio quando não há saldo suficiente.
- Mapear liderança a partir de alguém que já está no cadastro.
- Registrar ocorrência do dia da eleição e consultar a escala de plantões.
- Exportar pessoas e financeiro em CSV (arquivo real, abre no Excel ou no Sheets).

Tudo o que é registrado fica gravado: no modo local, no armazenamento do navegador;
com o Supabase conectado, no banco da campanha.

## Interações disponíveis

- **Busca global** (`/` ou `Ctrl/Cmd+K`) sobre pessoas, territórios, equipes, eventos e tarefas.
- **Mapa**: escolha da métrica (apoiadores, cobertura, meta, lideranças, atrasos, dias sem
  atividade), camadas de eventos/lideranças/equipes, zoom com a roda do mouse, arrasto e
  clique para abrir o território.
- **Tabelas**: ordenação por qualquer coluna, filtros combinados e paginação.
- **Tarefas**: quadro por situação e marcação das etapas concluídas.
- **Tema**: claro (padrão) e escuro, preservado entre sessões.
- **Teclado**: `/` ou `Ctrl/Cmd+K` focam a busca; `↑` `↓` percorrem os resultados; `Enter` abre; `Esc` fecha busca e janelas.
- **Filtros**: mostram quantos resultados restaram, quantos filtros estão ativos e trazem um botão para limpar tudo.

## Critério para usar gráfico

Gráfico aparece em dois lugares apenas: nos **relatórios** e onde ele mostra algo de
forma **interativa** (o mapa territorial, o funil do painel, a rede de indicações da
ficha de uma pessoa). Telas de cadastro e de ação não têm gráfico — nelas o coordenador
precisa de número, filtro, tabela e quadro, que se leem de relance e cabem no celular.

Quando um gráfico saiu de uma tela operacional, ele não foi jogado fora: foi para o
relatório correspondente, junto da tabela que o sustenta. As telas que perderam gráfico
trazem um link para onde ele foi.

## Sobre a base de demonstração

`demo.js` monta uma campanha fictícia (12 bairros, ~930 pessoas, 6 equipes, 55 tarefas,
22 eventos) usando **as mesmas funções de escrita das telas** — ou seja, exercita o mesmo
caminho que o uso real. Serve para apresentação e treinamento; nunca roda sozinho.
