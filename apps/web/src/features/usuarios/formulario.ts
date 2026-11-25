import {
  type PasswordReset,
  passwordResetSchema,
  type Role,
  type UserInput,
  type UserUpdateInput,
  userInputSchema,
  userUpdateInputSchema,
} from '@axis/contracts'

export type DadosFormularioUsuario = {
  name: string
  email: string
  registration: string
  role: Role
  coordinatorId?: string
  password?: string
}

export type ErrosFormularioUsuario = Partial<Record<keyof UserInput | 'coordinatorId', string>>

export function validarCriacaoUsuario(dados: DadosFormularioUsuario): {
  dados?: UserInput
  erros: ErrosFormularioUsuario
} {
  const objetoParaValidar = {
    name: dados.name.trim(),
    email: dados.email.trim(),
    registration: dados.registration.trim(),
    role: dados.role,
    coordinatorId: dados.role === 'seller' ? dados.coordinatorId?.trim() || null : null,
    password: dados.password ? dados.password : undefined,
  }

  const resultado = userInputSchema.safeParse(objetoParaValidar)
  if (resultado.success) {
    return { dados: resultado.data, erros: {} }
  }

  const erros: ErrosFormularioUsuario = {}
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof UserInput
    if (campo && !erros[campo]) {
      erros[campo] = issue.message
    }
  }

  return { erros }
}

export function validarEdicaoUsuario(dados: Omit<DadosFormularioUsuario, 'password'>): {
  dados?: UserUpdateInput
  erros: ErrosFormularioUsuario
} {
  const objetoParaValidar = {
    name: dados.name.trim(),
    email: dados.email.trim(),
    registration: dados.registration.trim(),
    role: dados.role,
    coordinatorId: dados.role === 'seller' ? dados.coordinatorId?.trim() || null : null,
  }

  const resultado = userUpdateInputSchema.safeParse(objetoParaValidar)
  if (resultado.success) {
    return { dados: resultado.data, erros: {} }
  }

  const erros: ErrosFormularioUsuario = {}
  for (const issue of resultado.error.issues) {
    const campo = issue.path[0] as keyof UserUpdateInput
    if (campo && !erros[campo]) {
      erros[campo] = issue.message
    }
  }

  return { erros }
}

export type ErrosRedefinicaoSenha = {
  newPassword?: string
  confirmPassword?: string
}

export function validarRedefinicaoSenha(dados: { newPassword: string; confirmPassword: string }): {
  dados?: PasswordReset
  erros: ErrosRedefinicaoSenha
} {
  const erros: ErrosRedefinicaoSenha = {}

  if (!dados.newPassword) {
    erros.newPassword = 'A nova senha é obrigatória'
  } else if (dados.newPassword.length < 6) {
    erros.newPassword = 'A nova senha deve ter no mínimo 6 caracteres'
  } else if (dados.newPassword.length > 128) {
    erros.newPassword = 'A nova senha tem no máximo 128 caracteres'
  }

  if (dados.newPassword !== dados.confirmPassword) {
    erros.confirmPassword = 'A confirmação de senha não confere'
  }

  if (Object.keys(erros).length > 0) {
    return { erros }
  }

  const resultado = passwordResetSchema.safeParse({ newPassword: dados.newPassword })
  if (!resultado.success) {
    return {
      erros: {
        newPassword: resultado.error.issues[0]?.message ?? 'Senha inválida',
      },
    }
  }

  return { dados: resultado.data, erros: {} }
}
