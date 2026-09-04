# Fluxo de Trabalho (Git & GitHub)

Este documento explica, passo a passo, como qualquer integrante do time deve trabalhar no repositório — desde criar uma branch até ter o código na `main`.

A branch `main` é protegida: **ninguém consegue enviar código direto para ela**. Toda mudança precisa passar por uma branch própria e um Pull Request (PR) revisado por outro integrante.

## Resumo do fluxo

```
main (atualizada) → cria branch → faz alterações → commit → push → Pull Request → aprovação → merge → sincroniza main
```

## Passo a passo

### 1. Sempre comece atualizando sua `main` local

Antes de iniciar qualquer tarefa nova, garanta que você está partindo da versão mais recente do projeto:

```bash
git checkout main
git pull
```

### 2. Crie uma branch para a sua tarefa

Nunca trabalhe direto na `main`. Crie uma branch nova, com nome que siga o padrão do projeto (veja a tabela abaixo):

```bash
git checkout -b tipo/nome-da-tarefa
```

Exemplos reais:

```bash
git checkout -b feature/checkin-geolocalizacao
git checkout -b fix/erro-cadastro-cliente
git checkout -b docs/requisitos-funcionais
```

| Prefixo | Quando usar |
|---|---|
| `feature/` | nova funcionalidade |
| `fix/` | correção de bug |
| `docs/` | mudanças de documentação |
| `chore/` | configuração, manutenção, tarefas que não são código de feature |

### 3. Faça as alterações

Edite os arquivos normalmente no seu editor.

### 4. Confira o que foi alterado

```bash
git status
```

### 5. Adicione e faça o commit

```bash
git add .
git commit -m "tipo: descrição curta do que foi feito"
```

O commit também segue um padrão (Conventional Commits) — veja a tabela completa no [`CONTRIBUTING.md`](../../CONTRIBUTING.md). Exemplos:

```bash
git commit -m "feat: adiciona tela de check-in de visita"
git commit -m "fix: corrige cálculo de rota otimizada"
git commit -m "docs: adiciona requisitos funcionais"
```

### 6. Envie a branch para o GitHub

```bash
git push -u origin tipo/nome-da-tarefa
```

Da segunda vez em diante, nessa mesma branch, basta `git push`.

### 7. Abra o Pull Request

Depois do push, o próprio terminal (ou o GitHub) mostra um link para abrir o PR. No GitHub:

1. Clique em **Compare & pull request**
2. Confirme que está indo de `sua-branch` → `main`
3. Preencha a descrição (o template já vem com um checklist)
4. Se a tarefa tiver uma issue relacionada, adicione `Closes #numero-da-issue` na descrição — isso fecha a issue automaticamente quando o PR for mergeado
5. Clique em **Create pull request**

### 8. Peça revisão

Marque um dos outros integrantes para revisar. O merge só é liberado com **pelo menos 1 aprovação**. Se houver comentários, ajuste o código, faça commit e push novamente na mesma branch — o PR atualiza sozinho.

### 9. Faça o merge

Depois de aprovado (e com os checks automáticos passando), clique em **Merge pull request** no GitHub.

### 10. Sincronize sua `main` local

Depois do merge, volte para sua máquina e atualize:

```bash
git checkout main
git pull
```

Você já pode deletar a branch local que não é mais necessária:

```bash
git branch -d tipo/nome-da-tarefa
```

## Erros comuns

**"push declined due to repository rule violations"**
Você tentou enviar direto para a `main`. Solução: crie uma branch (passo 2) e siga o fluxo normal a partir dela.

**PR travado, não deixa dar merge**
Confira se falta aprovação de alguém, ou se há comentários (conversas) não resolvidos na revisão — ambos são exigidos antes do merge.