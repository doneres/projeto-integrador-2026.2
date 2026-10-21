import { useClientes } from '../features/clientes/queries'

export function ClientesPage() {
  const { data, isPending, isError } = useClientes()

  return (
    <section>
      <h1 className="text-2xl font-bold">Clientes</h1>

      {isPending && <p className="mt-4 text-sm text-text-muted">Carregando clientes...</p>}
      {isError && <p className="mt-4 text-sm">Não foi possível carregar os clientes.</p>}

      {data && (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {data.map((cliente) => (
            <li key={cliente.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{cliente.nome}</p>
                <p className="text-sm text-text-muted">
                  {cliente.cidade} · CEP {cliente.cep}
                </p>
              </div>
              <span className="text-sm text-text-muted">{cliente.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
