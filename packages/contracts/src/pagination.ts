import { z } from 'zod'

// Paginação das listagens (convenção do #21) com os nomes em inglês do ADR 0001.

export const PER_PAGE_MAX = 100

/** Parâmetros de paginação das listagens: ?page=1&perPage=20 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(PER_PAGE_MAX).default(20),
})
export type Pagination = z.infer<typeof paginationSchema>

/** Envelope de uma página de resultados. */
export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    perPage: z.number().int().min(1).max(PER_PAGE_MAX),
  })
}
export type Page<T> = { items: T[]; total: number; page: number; perPage: number }
