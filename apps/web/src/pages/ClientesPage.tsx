import {
  type CustomerFilters,
  type CustomerStatus,
  type CustomerStatusChange,
  customerFiltersSchema,
} from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Botao, classesDeBotao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { CampoSelecao } from '../components/ui/CampoSelecao'
import { useAlterarStatusCliente, useClientes } from '../features/clientes/queries'
import { mensagemDeErro } from '../lib/erros'
import { formatarDocumento } from '../lib/formatacao'

const POR_PAGINA = 10
// A API usa os valores em inglês (ADR 0001); os rótulos em português são da interface.
// "Tipo" na tela é a origem do cliente no contrato (`origin`).
const ROTULO_TIPO = { portfolio: 'Carteira', prospect: 'Prospecção' } as const
const ROTULO_STATUS: Record<CustomerStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  // Só prospecções passam por estes dois; aparecem na lista, mas são tratadas na tela de Prospecções.
  pending_approval: 'Aguardando aprovação',
  rejected: 'Rejeitado',
}
const OPCOES_STATUS = [
  ['', 'Todos'],
  ['active', 'Ativos'],
  ['inactive', 'Inativos'],
] as const
const OPCOES_TIPO = [
  ['', 'Todos'],
  ['portfolio', 'Carteira'],
  ['prospect', 'Prospecção'],
] as const

type Confirmacao = { id: string; nome: string; novoStatus: CustomerStatusChange['status'] }

/** Os filtros ficam na URL: o link de uma busca abre a mesma lista. */
function lerFiltros(parametros: URLSearchParams): CustomerFilters {
  const resultado = customerFiltersSchema.safeParse({
    ...Object.fromEntries(parametros),
    perPage: POR_PAGINA,
  })
  // Um link inválido (ex.: salvo antes da troca para o contrato em inglês) abre a lista sem filtros.
  return resultado.success ? resultado.data : customerFiltersSchema.parse({ perPage: POR_PAGINA })
}

export function ClientesPage() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const clientes = useClientes(filtros)
  const alterarStatus = useAlterarStatusCliente()
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const mensagem = (useLocation().state as { mensagem?: string } | null)?.mensagem
  const temFiltros = Boolean(filtros.search || filtros.status || filtros.origin || filtros.district)

  function aplicar(mudancas: Record<string, string>) {
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
  }

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    aplicar({
      search: String(dados.get('search') ?? '').trim(),
      district: String(dados.get('district') ?? '').trim(),
    })
  }

  function irParaPagina(pagina: number) {
    const novos = new URLSearchParams(parametros)
    novos.set('page', String(pagina))
    setParametros(novos)
  }

  function confirmar() {
    if (!confirmacao) {
      return
    }
    alterarStatus.mutate(
      { id: confirmacao.id, status: confirmacao.novoStatus },
      { onSuccess: () => setConfirmacao(null) },
    )
  }

  const pagina = clientes.data
  const primeiro = pagina ? (pagina.page - 1) * pagina.perPage + 1 : 0
  const ultimo = pagina ? primeiro + pagina.items.length - 1 : 0

  return (
    <div className="flex flex-col gap-4">
      {mensagem && (
        <p
          aria-live="polite"
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          {mensagem}
        </p>
      )}

      <form
        key={parametros.toString()}
        aria-label="Buscar e filtrar clientes"
        onSubmit={buscar}
        className="flex flex-wrap items-end gap-3"
      >
        <Campo
          name="search"
          rotulo="Buscar"
          placeholder="Nome, razão social ou CNPJ/CPF"
          defaultValue={filtros.search ?? ''}
          className="min-w-64 flex-1"
        />
        <CampoSelecao
          rotulo="Status"
          opcoes={OPCOES_STATUS}
          value={filtros.status ?? ''}
          onChange={(evento) => aplicar({ status: evento.target.value })}
        />
        <CampoSelecao
          rotulo="Tipo"
          opcoes={OPCOES_TIPO}
          value={filtros.origin ?? ''}
          onChange={(evento) => aplicar({ origin: evento.target.value })}
        />
        <Campo
          name="district"
          rotulo="Bairro"
          placeholder="Todos"
          defaultValue={filtros.district ?? ''}
          className="w-44"
        />
        <Botao type="submit" variante="secundario">
          Buscar
        </Botao>
        <Link to="/clientes/novo" className={classesDeBotao('primario')}>
          + Novo cliente
        </Link>
      </form>

      {clientes.isPending && <p className="text-sm text-text-muted">Carregando clientes...</p>}

      {clientes.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"
        >
          <span>{mensagemDeErro(clientes.error)}</span>
          <Botao variante="secundario" onClick={() => clientes.refetch()}>
            Tentar de novo
          </Botao>
        </div>
      )}

      {pagina && pagina.items.length === 0 && (
        <div className="rounded-md border border-border px-4 py-6 text-sm">
          {temFiltros ? (
            <p>
              Nenhum cliente encontrado com esses filtros.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => setParametros(new URLSearchParams())}
              >
                Limpar filtros
              </button>
            </p>
          ) : (
            <p>Nenhum cliente cadastrado ainda.</p>
          )}
        </div>
      )}

      {pagina && pagina.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">
                Clientes{clientes.isFetching ? ' (atualizando)' : ''}
              </caption>
              <thead className="bg-muted text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Cliente
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    CNPJ/CPF
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Bairro · Cidade/UF
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tipo · Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagina.items.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{cliente.tradeName}</p>
                      <p className="text-text-muted">{cliente.legalName}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatarDocumento(cliente.document)}
                    </td>
                    <td className="px-4 py-3">
                      {cliente.district} · {cliente.city}/{cliente.state}
                    </td>
                    <td className="px-4 py-3">
                      {ROTULO_TIPO[cliente.origin]} · {ROTULO_STATUS[cliente.status]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link to={`/clientes/${cliente.id}/editar`} className="underline">
                          Editar<span className="sr-only"> {cliente.tradeName}</span>
                        </Link>
                        {/* Só cliente ativo ou inativo muda por aqui; a API recusa os demais (409). */}
                        {(cliente.status === 'active' || cliente.status === 'inactive') && (
                          <button
                            type="button"
                            className="underline"
                            onClick={() =>
                              setConfirmacao({
                                id: cliente.id,
                                nome: cliente.tradeName,
                                novoStatus: cliente.status === 'active' ? 'inactive' : 'active',
                              })
                            }
                          >
                            {cliente.status === 'active' ? 'Inativar' : 'Reativar'}
                            <span className="sr-only"> {cliente.tradeName}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirmacao && (
            <section
              aria-label="Confirmar alteração de status"
              className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-4 py-3 text-sm"
            >
              <p>
                {confirmacao.novoStatus === 'inactive'
                  ? `Inativar ${confirmacao.nome}? Você pode reativá-lo depois.`
                  : `Reativar ${confirmacao.nome}?`}
              </p>
              <Botao onClick={confirmar} disabled={alterarStatus.isPending}>
                {alterarStatus.isPending ? 'Salvando...' : 'Confirmar'}
              </Botao>
              <Botao variante="secundario" onClick={() => setConfirmacao(null)}>
                Cancelar
              </Botao>
            </section>
          )}
          {alterarStatus.isError && (
            <p role="alert" className="text-sm text-erro">
              {mensagemDeErro(alterarStatus.error)}
            </p>
          )}

          <nav aria-label="Paginação" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-text-muted">
              {primeiro}–{ultimo} de {pagina.total} {pagina.total === 1 ? 'cliente' : 'clientes'}
            </span>
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
          </nav>
        </>
      )}
    </div>
  )
}
