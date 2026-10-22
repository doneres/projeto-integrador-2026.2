import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { type FieldPath, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { Botao, classesDeBotao } from '../components/ui/Botao'
import { Campo } from '../components/ui/Campo'
import { buscarEnderecoPorCep } from '../features/clientes/cep'
import {
  type DadosFormularioCliente,
  formularioClienteSchema,
  paraDadosCliente,
  VALORES_INICIAIS,
  type ValoresFormularioCliente,
  valoresDoCliente,
} from '../features/clientes/formulario'
import { useCliente, useSalvarCliente } from '../features/clientes/queries'
import { ApiError } from '../lib/api'
import { mensagemDeErro } from '../lib/erros'

const MENSAGEM_CEP = {
  'nao-encontrado': 'Não encontramos esse CEP. Confira os dígitos ou preencha o endereço à mão.',
  indisponivel: 'O serviço de CEP não respondeu. Preencha o endereço à mão.',
} as const

/** Cadastro (sem id na rota) e edição (com id) de cliente (RF05), com busca de endereço por CEP (RF07). */
export function ClienteFormPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const cliente = useCliente(id)
  const salvar = useSalvarCliente(id)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    getValues,
    formState: { errors },
  } = useForm<ValoresFormularioCliente, unknown, DadosFormularioCliente>({
    resolver: zodResolver(formularioClienteSchema),
    defaultValues: VALORES_INICIAIS,
  })

  useEffect(() => {
    if (!id) {
      reset(VALORES_INICIAIS)
    } else if (cliente.data) {
      reset(valoresDoCliente(cliente.data))
    }
  }, [id, cliente.data, reset])

  async function preencherPeloCep() {
    setBuscandoCep(true)
    setAvisoCep(null)
    const resultado = await buscarEnderecoPorCep(getValues('endereco.cep'))
    setBuscandoCep(false)
    if (resultado.situacao !== 'encontrado') {
      setAvisoCep(MENSAGEM_CEP[resultado.situacao])
      return
    }
    for (const campo of ['logradouro', 'bairro', 'cidade', 'uf'] as const) {
      const valor = resultado.endereco[campo]
      if (valor) {
        setValue(`endereco.${campo}`, valor, { shouldValidate: true, shouldDirty: true })
      }
    }
    setAvisoCep('Endereço preenchido pelo CEP. Confira o número e o complemento.')
  }

  const enviar = handleSubmit((valores) => {
    salvar.mutate(paraDadosCliente(valores, cliente.data?.tipo ?? 'carteira'), {
      onSuccess: () =>
        navegar('/clientes', {
          state: { mensagem: id ? 'Cliente atualizado.' : 'Cliente cadastrado.' },
        }),
      onError: (erro) => {
        if (erro instanceof ApiError) {
          for (const { campo, mensagem } of erro.erros) {
            setError(campo as FieldPath<ValoresFormularioCliente>, { message: mensagem })
          }
        }
      },
    })
  })

  if (id && cliente.isPending) {
    return <p className="text-sm text-text-muted">Carregando cliente...</p>
  }
  if (id && cliente.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span>{mensagemDeErro(cliente.error)}</span>
        <Link to="/clientes" className="underline">
          Voltar para a lista
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} noValidate className="flex max-w-4xl flex-col gap-4">
      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <legend className="px-1 text-base font-medium">Dados do cliente</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo
            rotulo="Razão social"
            erro={errors.razaoSocial?.message}
            {...register('razaoSocial')}
          />
          <Campo
            rotulo="Nome fantasia"
            erro={errors.nomeFantasia?.message}
            {...register('nomeFantasia')}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Campo
            rotulo="CNPJ ou CPF"
            dica="Com ou sem máscara. Aceita o CNPJ alfanumérico."
            erro={errors.documento?.message}
            {...register('documento')}
          />
          <Campo
            rotulo="Telefone"
            inputMode="tel"
            placeholder="(62) 99999-0000"
            erro={errors.telefone?.message}
            {...register('telefone')}
          />
          <Campo
            rotulo="Contato"
            placeholder="Pessoa de contato"
            erro={errors.contato?.message}
            {...register('contato')}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <legend className="px-1 text-base font-medium">Endereço</legend>
        <div className="flex flex-wrap items-end gap-3">
          <Campo
            rotulo="CEP"
            inputMode="numeric"
            placeholder="00000-000"
            className="w-44"
            erro={errors.endereco?.cep?.message}
            {...register('endereco.cep')}
          />
          <Botao variante="secundario" onClick={preencherPeloCep} disabled={buscandoCep}>
            {buscandoCep ? 'Buscando...' : 'Buscar CEP'}
          </Botao>
          <p aria-live="polite" className="text-xs text-text-muted md:max-w-md">
            {avisoCep ?? 'Preenche logradouro, bairro, cidade e UF.'}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <Campo
            rotulo="Logradouro"
            placeholder="Rua, avenida..."
            erro={errors.endereco?.logradouro?.message}
            {...register('endereco.logradouro')}
          />
          <Campo
            rotulo="Número"
            placeholder="Ex.: 100 ou S/N"
            erro={errors.endereco?.numero?.message}
            {...register('endereco.numero')}
          />
          <Campo
            rotulo="Complemento"
            placeholder="Opcional"
            erro={errors.endereco?.complemento?.message}
            {...register('endereco.complemento')}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr]">
          <Campo
            rotulo="Bairro"
            erro={errors.endereco?.bairro?.message}
            {...register('endereco.bairro')}
          />
          <Campo
            rotulo="Cidade"
            erro={errors.endereco?.cidade?.message}
            {...register('endereco.cidade')}
          />
          <Campo
            rotulo="UF"
            maxLength={2}
            placeholder="GO"
            erro={errors.endereco?.uf?.message}
            {...register('endereco.uf')}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-5">
        <legend className="px-1 text-base font-medium">Localização (GPS)</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo
            rotulo="Latitude"
            inputMode="decimal"
            placeholder="-16.6869"
            erro={errors.localizacao?.latitude?.message}
            {...register('localizacao.latitude')}
          />
          <Campo
            rotulo="Longitude"
            inputMode="decimal"
            placeholder="-49.2648"
            erro={errors.localizacao?.longitude?.message}
            {...register('localizacao.longitude')}
          />
        </div>
        <p className="text-xs text-text-muted">
          Necessária para validar o check-in do vendedor no raio de 20 m (RN01).
        </p>
      </fieldset>

      {salvar.isError && (
        <p role="alert" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {mensagemDeErro(salvar.error)}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Link to="/clientes" className={classesDeBotao('secundario')}>
          Cancelar
        </Link>
        <Botao type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando...' : 'Salvar cliente'}
        </Botao>
      </div>
    </form>
  )
}
