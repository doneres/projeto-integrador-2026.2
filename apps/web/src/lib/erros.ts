import { ApiError } from './api'

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  SEM_CONEXAO: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  RESPOSTA_INVALIDA: 'O servidor enviou dados em um formato inesperado. Avise a equipe técnica.',
  NAO_AUTENTICADO: 'Sua sessão expirou. Entre novamente.',
}

/** Mensagem para mostrar ao usuário a partir de qualquer erro capturado na interface. */
export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof ApiError)) {
    return 'Algo deu errado. Tente de novo.'
  }
  const porCodigo = MENSAGENS_POR_CODIGO[erro.codigo]
  if (porCodigo) {
    return porCodigo
  }
  if (erro.status === 403) {
    return 'Você não tem permissão para esta ação.'
  }
  if (erro.status >= 500) {
    return 'O servidor está com problemas. Tente de novo em instantes.'
  }
  return erro.message
}
