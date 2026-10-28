import { type FiltrosClientes, filtrosClientesSchema, type StatusCliente } from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Botao, classesDeBotao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { CampoSelecao } from '../components/ui/CampoSelecao'
import { useAlterarStatusCliente, useClientes } from '../features/clientes/queries'
import { mensagemDeErro } from '../lib/erros'
import { formatarDocumento } from '../lib/formatacao'

const POR_PAGINA = 10
const ROTULO_TIPO = { carteira: 'Carteira', prospeccao: 'Prospecção' } as const
const ROTULO_STATUS = { ativo: 'Ativo', inativo: 'Inativo' } as const
const OPCOES_STATUS = [
  ['', 'Todos'],
  ['ativo', 'Ativos'],
  ['inativo', 'Inativos'],
] as const
const OPCOES_TIPO = [
  ['', 'Todos'],
  ['carteira', 'Carteira'],
  ['prospeccao', 'Prospecção'],
] as const

type Confirmacao = { id: string; nome: string; novoStatus: StatusCliente }

/** Os filtros ficam na URL: o link de uma busca abre a mesma lista. */
function lerFiltros(parametros: URLSearchParams): FiltrosClientes {
  const resultado = filtrosClientesSchema.safeParse({
    ...Object.fromEntries(parametros),
    porPagina: POR_PAGINA,
  })
  return resultado.success ? resultado.data : { pagina: 1, porPagina: POR_PAGINA }
}

export function ClientesPage() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = lerFiltros(parametros)
  const clientes = useClientes(filtros)
  const alterarStatus = useAlterarStatusCliente()
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const mensagem = (useLocation().state as { mensagem?: string } | null)?.mensagem
  const temFiltros = Boolean(filtros.busca || filtros.status || filtros.tipo || filtros.bairro)

  function aplicar(mudancas: Record<string, string>) {
    const novos = new URLSearchParams(parametros)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) {
        novos.set(chave, valor)
      } else {
        novos.delete(chave)
      }
    }
    novos.delete('pagina')
    setParametros(novos)
  }

  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    aplicar({
      busca: String(dados.get('busca') ?? '').trim(),
      bairro: String(dados.get('bairro') ?? '').trim(),
    })
  }

  function irParaPagina(pagina: number) {
    const novos = new URLSearchParams(parametros)
    novos.set('pagina', String(pagina))
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
  const primeiro = pagina ? (pagina.pagina - 1) * pagina.porPagina + 1 : 0
  const ultimo = pagina ? primeiro + pagina.itens.length - 1 : 0

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
          name="busca"
          rotulo="Buscar"
          placeholder="Nome, razão social ou CNPJ/CPF"
          defaultValue={filtros.busca ?? ''}
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
          value={filtros.tipo ?? ''}
          onChange={(evento) => aplicar({ tipo: evento.target.value })}
        />
        <Campo
          name="bairro"
          rotulo="Bairro"
          placeholder="Todos"
          defaultValue={filtros.bairro ?? ''}
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

      {pagina && pagina.itens.length === 0 && (
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

      {pagina && pagina.itens.length > 0 && (
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
                {pagina.itens.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{cliente.nomeFantasia}</p>
                      <p className="text-text-muted">{cliente.razaoSocial}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatarDocumento(cliente.documento)}
                    </td>
                    <td className="px-4 py-3">
                      {cliente.endereco.bairro} · {cliente.endereco.cidade}/{cliente.endereco.uf}
                    </td>
                    <td className="px-4 py-3">
                      {ROTULO_TIPO[cliente.tipo]} · {ROTULO_STATUS[cliente.status]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link to={`/clientes/${cliente.id}/editar`} className="underline">
                          Editar<span className="sr-only"> {cliente.nomeFantasia}</span>
                        </Link>
                        <button
                          type="button"
                          className="underline"
                          onClick={() =>
                            setConfirmacao({
                              id: cliente.id,
                              nome: cliente.nomeFantasia,
                              novoStatus: cliente.status === 'ativo' ? 'inativo' : 'ativo',
                            })
                          }
                        >
                          {cliente.status === 'ativo' ? 'Inativar' : 'Reativar'}
                          <span className="sr-only"> {cliente.nomeFantasia}</span>
                        </button>
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
                {confirmacao.novoStatus === 'inativo'
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
              disabled={pagina.pagina <= 1}
              onClick={() => irParaPagina(pagina.pagina - 1)}
            >
              Anterior
            </Botao>
            <Botao
              variante="secundario"
              disabled={ultimo >= pagina.total}
              onClick={() => irParaPagina(pagina.pagina + 1)}
            >
              Próxima
            </Botao>
          </nav>
        </>
      )}
    </div>
  )
}
