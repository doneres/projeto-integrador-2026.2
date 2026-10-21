import { useClientes } from '../features/clientes/queries'
import { mensagemDeErro } from '../lib/erros'

const ROTULO_TIPO = { carteira: 'Carteira', prospeccao: 'Prospecção' } as const
const ROTULO_STATUS = { ativo: 'Ativo', inativo: 'Inativo' } as const

export function ClientesPage() {
  const { data, isPending, isError, error } = useClientes()

  return (
    <section>
      {isPending && <p className="mt-4 text-sm text-text-muted">Carregando clientes...</p>}

      {isError && (
        <p className="mt-4 text-sm" role="alert">
          {mensagemDeErro(error)}
        </p>
      )}

      {data && data.itens.length === 0 && (
        <p className="mt-4 text-sm text-text-muted">Nenhum cliente cadastrado ainda.</p>
      )}

      {data && data.itens.length > 0 && (
        <>
          <p className="mt-4 text-sm text-text-muted">
            {data.total === 1 ? '1 cliente' : `${data.total} clientes`}
          </p>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {data.itens.map((cliente) => (
              <li key={cliente.id} className="flex items-center justify-between gap-4 p-3">
                <div>
                  <p className="font-medium">{cliente.nomeFantasia}</p>
                  <p className="text-sm text-text-muted">
                    {cliente.endereco.bairro} · {cliente.endereco.cidade}/{cliente.endereco.uf}
                  </p>
                </div>
                <div className="text-right text-sm text-text-muted">
                  <p>{ROTULO_TIPO[cliente.tipo]}</p>
                  <p>{ROTULO_STATUS[cliente.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
