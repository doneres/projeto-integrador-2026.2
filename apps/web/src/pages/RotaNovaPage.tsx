import { createRouteBodySchema, customerFiltersSchema } from '@axis/contracts'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Botao, classesDeBotao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { CampoSelecao } from '../components/ui/CampoSelecao'
import { useClientes } from '../features/clientes/queries'
import { alternarCliente, moverCliente } from '../features/rotas/montagem'
import { useCriarRota, useVendedores } from '../features/rotas/queries'
import { ApiError } from '../lib/api'
import { hojeEmSaoPaulo } from '../lib/datas'
import { mensagemDeErro } from '../lib/erros'

// Só cliente ativo entra em rota (modelo de dados #26). A API devolve no máximo 100 por página,
// o mesmo teto de clientes de uma rota.
const FILTRO_CLIENTES_ATIVOS = customerFiltersSchema.parse({ status: 'active', perPage: 100 })

type Erros = Partial<Record<'sellerId' | 'date' | 'customerIds', string>>

/** Montagem da rota diária de um vendedor (#39, RF10): vendedor, data, clientes e ordem. */
export function RotaNovaPage() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const vendedores = useVendedores()
  const clientes = useClientes(FILTRO_CLIENTES_ATIVOS)
  const criar = useCriarRota()
  const [vendedor, setVendedor] = useState('')
  const [data, setData] = useState(parametros.get('date') ?? hojeEmSaoPaulo())
  const [ordem, setOrdem] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [erros, setErros] = useState<Erros>({})

  const todos = clientes.data?.items ?? []
  const porId = new Map(todos.map((c) => [c.id, c]))
  const termo = busca.trim().toLowerCase()
  const visiveis = termo
    ? todos.filter(
        (c) =>
          c.tradeName.toLowerCase().includes(termo) || c.district.toLowerCase().includes(termo),
      )
    : todos

  // O aviso de um campo some assim que o usuário mexe nele.
  function limparErro(campo: keyof Erros) {
    setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  function mudarOrdem(mudanca: (atual: string[]) => string[]) {
    setOrdem(mudanca)
    limparErro('customerIds')
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const corpo = createRouteBodySchema.safeParse({
      sellerId: vendedor,
      date: data,
      customerIds: ordem,
    })
    if (!corpo.success) {
      const novos: Erros = {}
      for (const issue of corpo.error.issues) {
        const campo = issue.path[0] as keyof Erros
        novos[campo] ??=
          campo === 'sellerId'
            ? 'Escolha o vendedor'
            : campo === 'date'
              ? 'Informe a data'
              : issue.message
      }
      setErros(novos)
      return
    }
    setErros({})
    criar.mutate(corpo.data, {
      onSuccess: (rota) => navegar(`/rotas/${rota.id}`, { state: { mensagem: 'Rota montada.' } }),
      onError: (erro) => {
        if (erro instanceof ApiError && erro.erros.length > 0) {
          setErros(
            Object.fromEntries(erro.erros.map(({ campo, mensagem }) => [campo, mensagem])) as Erros,
          )
        }
      },
    })
  }

  const opcoesVendedor = [
    ['', vendedores.isPending ? 'Carregando...' : 'Escolha o vendedor'] as const,
    ...(vendedores.data?.items.map((v) => [v.id, v.name] as const) ?? []),
  ]

  return (
    <form onSubmit={salvar} noValidate className="flex max-w-5xl flex-col gap-4">
      <fieldset className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-5">
        <legend className="px-1 text-base font-medium">Vendedor e data</legend>
        <div className="flex flex-col gap-1">
          <CampoSelecao
            rotulo="Vendedor"
            opcoes={opcoesVendedor}
            value={vendedor}
            onChange={(evento) => {
              setVendedor(evento.target.value)
              limparErro('sellerId')
            }}
            aria-invalid={erros.sellerId ? true : undefined}
          />
          {erros.sellerId && <p className="text-xs text-erro">{erros.sellerId}</p>}
        </div>
        <Campo
          rotulo="Data"
          type="date"
          value={data}
          onChange={(evento) => {
            setData(evento.target.value)
            limparErro('date')
          }}
          erro={erros.date}
          className="w-44"
        />
      </fieldset>

      {vendedores.isError && (
        <p role="alert" className="text-sm text-erro">
          Não foi possível carregar os vendedores: {mensagemDeErro(vendedores.error)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-5">
          <legend className="px-1 text-base font-medium">Clientes ativos da Equipe</legend>
          <Campo
            rotulo="Filtrar clientes"
            placeholder="Nome fantasia ou bairro"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
          {clientes.isPending && <p className="text-sm text-text-muted">Carregando clientes...</p>}
          {clientes.isError && (
            <p role="alert" className="text-sm text-erro">
              {mensagemDeErro(clientes.error)}
            </p>
          )}
          {clientes.data && visiveis.length === 0 && (
            <p className="text-sm text-text-muted">Nenhum cliente ativo encontrado.</p>
          )}
          <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
            {visiveis.map((cliente) => (
              <li key={cliente.id}>
                <label className="flex cursor-pointer items-center gap-3 px-1 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={ordem.includes(cliente.id)}
                    onChange={() => mudarOrdem((atual) => alternarCliente(atual, cliente.id))}
                  />
                  <span>
                    <span className="font-medium">{cliente.tradeName}</span>
                    <span className="text-text-muted">
                      {' '}
                      · {cliente.district}, {cliente.city}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-5">
          <legend className="px-1 text-base font-medium">Ordem das visitas ({ordem.length})</legend>
          {ordem.length === 0 ? (
            <p className="text-sm text-text-muted">
              Marque os clientes ao lado. A ordem aqui é a ordem em que o vendedor visita.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {ordem.map((id, indice) => {
                const nome = porId.get(id)?.tradeName ?? 'Cliente'
                return (
                  <li key={id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-6 text-right tabular-nums text-text-muted">
                      {indice + 1}.
                    </span>
                    <span className="flex-1 font-medium">{nome}</span>
                    <Botao
                      variante="secundario"
                      className="px-2 py-1"
                      disabled={indice === 0}
                      aria-label={`Subir ${nome}`}
                      onClick={() => mudarOrdem((atual) => moverCliente(atual, id, -1))}
                    >
                      ↑
                    </Botao>
                    <Botao
                      variante="secundario"
                      className="px-2 py-1"
                      disabled={indice === ordem.length - 1}
                      aria-label={`Descer ${nome}`}
                      onClick={() => mudarOrdem((atual) => moverCliente(atual, id, 1))}
                    >
                      ↓
                    </Botao>
                    <button
                      type="button"
                      className="px-1 underline"
                      onClick={() => mudarOrdem((atual) => alternarCliente(atual, id))}
                    >
                      Tirar<span className="sr-only"> {nome}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
          {erros.customerIds && <p className="text-xs text-erro">{erros.customerIds}</p>}
        </fieldset>
      </div>

      {criar.isError && (
        <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {mensagemDeErro(criar.error)}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Link to="/rotas" className={classesDeBotao('secundario')}>
          Cancelar
        </Link>
        <Botao type="submit" disabled={criar.isPending}>
          {criar.isPending ? 'Salvando...' : 'Salvar rota'}
        </Botao>
      </div>
    </form>
  )
}
