import { type Product, type ProductFilters, productFiltersSchema } from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Botao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { CampoSelecao } from '../components/ui/CampoSelecao'
import {
  centavosParaReais,
  type ErrosFormularioProduto,
  validarDadosProduto,
} from '../features/produtos/formulario'
import {
  useAlterarStatusProduto,
  useProdutos,
  useSalvarProduto,
} from '../features/produtos/queries'
import { mensagemDeErro } from '../lib/erros'
import { formatarMoeda } from '../lib/formatacao'
import { useSessao } from '../lib/sessao'

const POR_PAGINA = 10

type ConfirmacaoStatus = { id: string; nome: string; novoStatus: boolean }

type EstadoFormulario = {
  aberto: boolean
  id?: string
  sku: string
  name: string
  category: string
  preco: string
  referenceStock: string
  imageUrl: string
  erros: ErrosFormularioProduto
}

const ESTADO_FORMULARIO_INICIAL: EstadoFormulario = {
  aberto: false,
  sku: '',
  name: '',
  category: '',
  preco: '',
  referenceStock: '0',
  imageUrl: '',
  erros: {},
}

function lerFiltros(parametros: URLSearchParams): ProductFilters {
  const entradas = Object.fromEntries(parametros)
  const resultado = productFiltersSchema.safeParse({
    ...entradas,
    active: entradas.active === '' ? undefined : entradas.active,
    perPage: POR_PAGINA,
  })
  return resultado.success ? resultado.data : productFiltersSchema.parse({ perPage: POR_PAGINA })
}

export function ProdutosPage() {
  const sessao = useSessao()
  const eAdmin = sessao?.user.role === 'administrator'

  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)

  const produtos = useProdutos(filtros)
  const salvarProduto = useSalvarProduto()
  const alterarStatus = useAlterarStatusProduto()

  const [formulario, setFormulario] = useState<EstadoFormulario>(ESTADO_FORMULARIO_INICIAL)
  const [confirmacaoStatus, setConfirmacaoStatus] = useState<ConfirmacaoStatus | null>(null)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)

  function aplicarFiltros(mudancas: Record<string, string>) {
    const novos = new URLSearchParams(parametros)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) {
        novos.set(chave, valor)
      } else {
        novos.delete(chave)
      }
    }
    novos.delete('page')
    setParametros(novos)
    setMensagemSucesso(null)
  }

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    aplicarFiltros({
      search: String(dados.get('search') ?? '').trim(),
      category: String(dados.get('category') ?? '').trim(),
    })
  }

  function limparFiltros() {
    setParametros(new URLSearchParams())
  }

  function irParaPagina(pagina: number) {
    const novos = new URLSearchParams(parametros)
    novos.set('page', String(pagina))
    setParametros(novos)
  }

  function abrirNovo() {
    setFormulario({
      aberto: true,
      sku: '',
      name: '',
      category: '',
      preco: '',
      referenceStock: '0',
      imageUrl: '',
      erros: {},
    })
    setMensagemSucesso(null)
  }

  function abrirEdicao(produto: Product) {
    setFormulario({
      aberto: true,
      id: produto.id,
      sku: produto.sku,
      name: produto.name,
      category: produto.category,
      preco: centavosParaReais(produto.unitPriceCents),
      referenceStock: String(produto.referenceStock),
      imageUrl: produto.imageUrl ?? '',
      erros: {},
    })
    setMensagemSucesso(null)
  }

  function fecharFormulario() {
    setFormulario(ESTADO_FORMULARIO_INICIAL)
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const { dados, erros } = validarDadosProduto({
      sku: formulario.sku,
      name: formulario.name,
      category: formulario.category,
      preco: formulario.preco,
      referenceStock: formulario.referenceStock,
      imageUrl: formulario.imageUrl,
    })

    if (!dados || Object.keys(erros).length > 0) {
      setFormulario((f) => ({ ...f, erros }))
      return
    }

    salvarProduto.mutate(dados, {
      onSuccess: (salvo) => {
        fecharFormulario()
        setMensagemSucesso(
          formulario.id
            ? `Produto "${salvo.name}" atualizado com sucesso!`
            : `Produto "${salvo.name}" cadastrado com sucesso!`,
        )
      },
    })
  }

  function confirmarMudancaStatus() {
    if (!confirmacaoStatus) return
    alterarStatus.mutate(
      { id: confirmacaoStatus.id, active: confirmacaoStatus.novoStatus },
      {
        onSuccess: (atualizado) => {
          setConfirmacaoStatus(null)
          setMensagemSucesso(
            atualizado.active
              ? `Produto "${atualizado.name}" reativado no catálogo.`
              : `Produto "${atualizado.name}" inativado. Não aparecerá em novos pedidos.`,
          )
        },
      },
    )
  }

  const pagina = produtos.data
  const primeiro = pagina ? (pagina.page - 1) * pagina.perPage + 1 : 0
  const ultimo = pagina ? primeiro + pagina.items.length - 1 : 0
  const temFiltrosAtivos = Boolean(
    filtros.search || filtros.category || filtros.active !== undefined,
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Catálogo de Produtos</h1>
            <p className="text-sm text-text-muted">
              Cadastro e controle de preços dos produtos comercializados nos pedidos de reposição
              (RF20).
            </p>
          </div>
          {eAdmin && (
            <Botao onClick={abrirNovo} disabled={formulario.aberto}>
              + Novo produto
            </Botao>
          )}
        </div>

        {!eAdmin && (
          <div
            role="status"
            className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <strong>Modo somente leitura:</strong> Você está conectado com um perfil sem permissão
            de edição. Apenas o Administrador pode cadastrar, editar e inativar produtos.
          </div>
        )}

        {mensagemSucesso && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          >
            <span>{mensagemSucesso}</span>
            <button
              type="button"
              className="text-xs font-semibold underline"
              onClick={() => setMensagemSucesso(null)}
            >
              Fechar
            </button>
          </div>
        )}
      </header>

      {/* Formulário Modal de Criação / Edição */}
      {formulario.aberto && (
        <section
          aria-label={formulario.id ? 'Editar produto' : 'Novo produto'}
          className="rounded-lg border-2 border-brand bg-surface p-5 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-lg font-bold">
              {formulario.id ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </h2>
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text"
              onClick={fecharFormulario}
            >
              ✕ Cancelar
            </button>
          </div>

          <form onSubmit={salvar} className="mt-4 flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <Campo
                  rotulo="SKU (código único) *"
                  id="produto-sku"
                  value={formulario.sku}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      sku: e.target.value.toUpperCase(),
                      erros: { ...f.erros, sku: undefined },
                    }))
                  }
                  placeholder="Ex.: CERV-PIL-350"
                  erro={formulario.erros.sku}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <Campo
                  rotulo="Nome do produto *"
                  id="produto-nome"
                  value={formulario.name}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      name: e.target.value,
                      erros: { ...f.erros, name: undefined },
                    }))
                  }
                  placeholder="Ex.: Cerveja Pilsen Lata 350ml"
                  erro={formulario.erros.name}
                  required
                />
              </div>

              <div>
                <Campo
                  rotulo="Categoria *"
                  id="produto-categoria"
                  value={formulario.category}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      category: e.target.value,
                      erros: { ...f.erros, category: undefined },
                    }))
                  }
                  placeholder="Ex.: Cervejas, Sucos, Refrigerantes"
                  erro={formulario.erros.category}
                  required
                />
              </div>

              <div>
                <Campo
                  rotulo="Preço unitário (R$) *"
                  id="produto-preco"
                  value={formulario.preco}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      preco: e.target.value,
                      erros: { ...f.erros, unitPriceCents: undefined },
                    }))
                  }
                  placeholder="Ex.: 4,50"
                  erro={formulario.erros.unitPriceCents}
                  required
                />
              </div>

              <div>
                <Campo
                  rotulo="Estoque de referência (unidades) *"
                  id="produto-estoque"
                  type="number"
                  min="0"
                  value={formulario.referenceStock}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      referenceStock: e.target.value,
                      erros: { ...f.erros, referenceStock: undefined },
                    }))
                  }
                  placeholder="Ex.: 500"
                  erro={formulario.erros.referenceStock}
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <Campo
                  rotulo="URL da imagem (opcional)"
                  id="produto-imagem"
                  type="url"
                  value={formulario.imageUrl}
                  onChange={(e) =>
                    setFormulario((f) => ({
                      ...f,
                      imageUrl: e.target.value,
                      erros: { ...f.erros, imageUrl: undefined },
                    }))
                  }
                  placeholder="https://exemplo.com/fotos/produto.png"
                  erro={formulario.erros.imageUrl}
                />
              </div>
            </div>

            {salvarProduto.isError && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {mensagemDeErro(salvarProduto.error)}
              </p>
            )}

            <div className="mt-2 flex gap-2">
              <Botao type="submit" disabled={salvarProduto.isPending}>
                {salvarProduto.isPending ? 'Salvando...' : 'Salvar produto'}
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                onClick={fecharFormulario}
                disabled={salvarProduto.isPending}
              >
                Cancelar
              </Botao>
            </div>
          </form>
        </section>
      )}

      {/* Caixa de Confirmação de Inativação / Reativação */}
      {confirmacaoStatus && (
        <section
          aria-label="Confirmar alteração de status do produto"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted p-4 text-sm"
        >
          <div>
            <p className="font-semibold text-text">
              {confirmacaoStatus.novoStatus
                ? `Reativar o produto "${confirmacaoStatus.nome}"?`
                : `Inativar o produto "${confirmacaoStatus.nome}"?`}
            </p>
            <p className="text-xs text-text-muted">
              {confirmacaoStatus.novoStatus
                ? 'O produto voltará a ser exibido para os vendedores nos pedidos em campo.'
                : 'Produtos inativados não aparecem em novos pedidos, mas continuam preservados no histórico de vendas (RN04).'}
            </p>
          </div>
          <div className="flex gap-2">
            <Botao onClick={confirmarMudancaStatus} disabled={alterarStatus.isPending}>
              {alterarStatus.isPending ? 'Salvando...' : 'Confirmar'}
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => setConfirmacaoStatus(null)}
              disabled={alterarStatus.isPending}
            >
              Cancelar
            </Botao>
          </div>
        </section>
      )}

      {/* Filtros e Busca */}
      <form
        onSubmit={buscar}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 text-sm"
      >
        <div className="min-w-64 flex-1">
          <Campo
            rotulo="Buscar por nome, SKU ou categoria"
            name="search"
            defaultValue={filtros.search ?? ''}
            placeholder="Ex.: Pilsen, CERV ou Cervejas..."
          />
        </div>

        <div className="w-48">
          <CampoSelecao
            rotulo="Status"
            name="active"
            value={filtros.active === undefined ? '' : String(filtros.active)}
            onChange={(e) => aplicarFiltros({ active: e.target.value })}
            opcoes={[
              ['', 'Todos'],
              ['true', 'Ativos'],
              ['false', 'Inativos'],
            ]}
          />
        </div>

        <div className="flex gap-2">
          <Botao type="submit">Buscar</Botao>
          {temFiltrosAtivos && (
            <Botao type="button" variante="secundario" onClick={limparFiltros}>
              Limpar
            </Botao>
          )}
        </div>
      </form>

      {/* Estados de Carregamento e Erro */}
      {produtos.isPending && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded bg-muted" />
        </div>
      )}

      {produtos.isError && (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          <p className="font-semibold">Erro ao carregar os produtos do catálogo.</p>
          <p className="mt-1">{mensagemDeErro(produtos.error)}</p>
          <Botao variante="secundario" className="mt-3" onClick={() => produtos.refetch()}>
            Tentar novamente
          </Botao>
        </div>
      )}

      {/* Lista de Produtos */}
      {pagina && (
        <>
          {pagina.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center">
              <span className="text-3xl" aria-hidden="true">
                📦
              </span>
              <h2 className="mt-2 text-base font-bold">Nenhum produto encontrado</h2>
              <p className="mt-1 max-w-md text-sm text-text-muted">
                {temFiltrosAtivos
                  ? 'Nenhum item corresponde aos critérios de pesquisa informados.'
                  : 'O catálogo está vazio no momento. Cadastre produtos para disponibilizá-los aos vendedores em campo.'}
              </p>
              {temFiltrosAtivos ? (
                <Botao variante="secundario" className="mt-4" onClick={limparFiltros}>
                  Limpar filtros
                </Botao>
              ) : eAdmin ? (
                <Botao className="mt-4" onClick={abrirNovo}>
                  + Cadastrar primeiro produto
                </Botao>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Tabela do catálogo de produtos</caption>
                <thead className="border-b border-border bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Produto / SKU
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Categoria
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Preço Unitário
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Estoque Referência
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagina.items.map((produto) => (
                    <tr key={produto.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          {produto.imageUrl ? (
                            <img
                              src={produto.imageUrl}
                              alt=""
                              className="h-10 w-10 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div
                              aria-hidden="true"
                              className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-lg"
                            >
                              📦
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-text">{produto.name}</div>
                            <div className="font-mono text-xs text-text-muted">{produto.sku}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-text-muted">
                          {produto.category}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle font-medium text-text">
                        {formatarMoeda(produto.unitPriceCents)}
                      </td>

                      <td className="px-4 py-3 align-middle text-text-muted">
                        {produto.referenceStock} un.
                      </td>

                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            produto.active
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              produto.active ? 'bg-emerald-500' : 'bg-zinc-400'
                            }`}
                          />
                          {produto.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle text-right">
                        <div className="flex justify-end gap-2">
                          <Botao
                            variante="secundario"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => abrirEdicao(produto)}
                            disabled={!eAdmin}
                            title={
                              eAdmin ? 'Editar produto' : 'Apenas Administradores podem editar'
                            }
                          >
                            Editar
                          </Botao>
                          <button
                            type="button"
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              produto.active
                                ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            }`}
                            onClick={() =>
                              setConfirmacaoStatus({
                                id: produto.id,
                                nome: produto.name,
                                novoStatus: !produto.active,
                              })
                            }
                            disabled={!eAdmin}
                            title={
                              eAdmin
                                ? produto.active
                                  ? 'Inativar produto'
                                  : 'Reativar produto'
                                : 'Apenas Administradores podem inativar ou reativar'
                            }
                          >
                            {produto.active ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {pagina.total > 0 && (
            <nav
              aria-label="Paginação"
              className="flex flex-wrap items-center justify-between gap-3 text-sm"
            >
              <span className="text-text-muted">
                {primeiro}–{ultimo} de {pagina.total} {pagina.total === 1 ? 'produto' : 'produtos'}
              </span>
              <div className="flex gap-2">
                <Botao
                  variante="secundario"
                  disabled={pagina.page <= 1}
                  onClick={() => irParaPagina(pagina.page - 1)}
                >
                  Anterior
                </Botao>
                <Botao
                  variante="secundario"
                  disabled={ultimo >= pagina.total}
                  onClick={() => irParaPagina(pagina.page + 1)}
                >
                  Próxima
                </Botao>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
