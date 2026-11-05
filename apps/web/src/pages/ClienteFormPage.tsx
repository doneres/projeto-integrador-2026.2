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
  VALORES_INICIAIS,
  type ValoresFormularioCliente,
  valoresDoCliente,
} from '../features/clientes/formulario'
import { useCliente, useSalvarCliente } from '../features/clientes/queries'
import { ApiError } from '../lib/api'
import { mensagemDeErro } from '../lib/erros'

/** Campo do endereço devolvido pelo serviço de CEP → campo do formulário (nomes da API). */
const CAMPOS_DO_CEP = {
  logradouro: 'street',
  bairro: 'district',
  cidade: 'city',
  uf: 'state',
} as const

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
    const resultado = await buscarEnderecoPorCep(getValues('zipCode'))
    setBuscandoCep(false)
    if (resultado.situacao !== 'encontrado') {
      setAvisoCep(MENSAGEM_CEP[resultado.situacao])
      return
    }
    for (const [doCep, doFormulario] of Object.entries(CAMPOS_DO_CEP)) {
      const valor = resultado.endereco[doCep as keyof typeof CAMPOS_DO_CEP]
      if (valor) {
        setValue(doFormulario, valor, { shouldValidate: true, shouldDirty: true })
      }
    }
    setAvisoCep('Endereço preenchido pelo CEP. Confira o número e o complemento.')
  }

  const enviar = handleSubmit((valores) => {
    // O formulário não escolhe mais o "Tipo" (#57): pelo modelo de dados (#26), quem cadastra
    // pelo painel é o Coordenador e o cliente nasce sempre de carteira (`portfolio`); prospecção
    // só vem do app do Vendedor. A origem é definida pela API e não muda na edição.
    salvar.mutate(valores, {
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
            erro={errors.legalName?.message}
            {...register('legalName')}
          />
          <Campo
            rotulo="Nome fantasia"
            erro={errors.tradeName?.message}
            {...register('tradeName')}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Campo
            rotulo="CNPJ ou CPF"
            dica="Com ou sem máscara. Aceita o CNPJ alfanumérico."
            erro={errors.document?.message}
            {...register('document')}
          />
          <Campo
            rotulo="Telefone"
            inputMode="tel"
            placeholder="(62) 99999-0000"
            erro={errors.phone?.message}
            {...register('phone')}
          />
          <Campo
            rotulo="Contato"
            placeholder="Pessoa de contato"
            erro={errors.contactName?.message}
            {...register('contactName')}
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
            erro={errors.zipCode?.message}
            {...register('zipCode')}
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
            erro={errors.street?.message}
            {...register('street')}
          />
          <Campo
            rotulo="Número"
            placeholder="Ex.: 100 ou S/N"
            erro={errors.number?.message}
            {...register('number')}
          />
          <Campo
            rotulo="Complemento"
            placeholder="Opcional"
            erro={errors.complement?.message}
            {...register('complement')}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr]">
          <Campo rotulo="Bairro" erro={errors.district?.message} {...register('district')} />
          <Campo rotulo="Cidade" erro={errors.city?.message} {...register('city')} />
          <Campo
            rotulo="UF"
            maxLength={2}
            placeholder="GO"
            erro={errors.state?.message}
            {...register('state')}
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
            erro={errors.latitude?.message}
            {...register('latitude')}
          />
          <Campo
            rotulo="Longitude"
            inputMode="decimal"
            placeholder="-49.2648"
            erro={errors.longitude?.message}
            {...register('longitude')}
          />
        </div>
        <p className="text-xs text-text-muted">
          Necessária para validar o check-in do vendedor no raio definido nos parâmetros do sistema
          (padrão de 100 m, RN01).
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
