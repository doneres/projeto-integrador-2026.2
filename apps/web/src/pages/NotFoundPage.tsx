import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-sm p-4">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <Link to="/" className="mt-4 inline-block underline">
        Voltar ao painel
      </Link>
    </section>
  )
}
